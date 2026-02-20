const BRAND_MODEL_SIGNATURES = {
    'PUMA': ['MB.01', 'MB.02', 'MB.03', 'MB.04', 'MB.05', 'MB.06', 'CLYDE', 'RS-X', 'SUEDE'],
    'NIKE': ['DUNK', 'AIR MAX', 'AIR FORCE', 'JORDAN', 'BLAZER', 'CORTEZ', 'WAFFLE'],
    'ADIDAS': ['YEEZY', 'ULTRABOOST', 'NMD', 'STAN SMITH', 'SAMBA', 'GAZELLE', 'FORUM'],
    'NEW BALANCE': ['990', '992', '993', '550', '574', '327', '2002'],
    'ASICS': ['GEL-LYTE', 'GEL-KAYANO', 'GEL-NIMBUS', 'GT-2000'],
};

class SemanticValidator {
    constructor() { }

    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        console.log(`[Agent 3 - Semantic] Validation started for: ${rawItem.raw_title}`);

        await new Promise(resolve => setTimeout(resolve, 100));

        const titleUpper = rawItem.raw_title.toUpperCase();
        const brandUpper = brand.toUpperCase();
        const modelUpper = (model || '').toUpperCase();

        // Strict Version Matching (e.g., MB.05 vs MB.04, Jordan 1 vs Jordan 4)
        const targetVersionMatch = modelUpper.match(/([A-Z]+)[.\s-]*(\d+(?:\.\d+)?)/);
        if (targetVersionMatch) {
            const prefix = targetVersionMatch[1];
            const targetVersionString = targetVersionMatch[2];
            const targetVersion = parseFloat(targetVersionString);

            // Extract ALL numbers found right after the prefix in the title
            const regex = new RegExp(prefix + '[.\\s-]*(\\d+(?:\\.\\d+)?)', 'g');
            let match;
            let foundAnyVersion = false;
            let exactVersionMatch = false;

            while ((match = regex.exec(titleUpper)) !== null) {
                foundAnyVersion = true;
                const foundVersion = parseFloat(match[1]);
                if (foundVersion === targetVersion) {
                    exactVersionMatch = true;
                }
            }

            // CRITICAL: If the title explicitly contains a version number for this prefix,
            // and it is NOT our target version, REJECT IMMEDIATELY.
            // Example: We want "MB.05". Title says "MB.04". foundAnyVersion=true, exact=false -> REJECT.
            if (foundAnyVersion && !exactVersionMatch) {
                console.log(`[Agent 3 - Semantic] REJECTED (Strict Version Mismatch: Expected ${prefix} ${targetVersionString}): ${rawItem.raw_title}`);
                return false;
            }
        }

        const junkKeywords = ['LACES', 'SOCKS', 'BOX ONLY', 'CLEAN KIT', 'CLEANING KIT', 'INSOLE', 'KEEPER'];
        if (junkKeywords.some(k => titleUpper.includes(k))) {
            const shoeKeywords = ['SHOE', 'SNEAKER', 'BOOT', 'TRAINER', 'נעל', 'סניקר', 'כדורסל'];
            const isShoe = shoeKeywords.some(k => titleUpper.includes(k));
            if (!isShoe) {
                console.log(`[Agent 3 - Semantic] REJECTED (Accessory/Junk): ${rawItem.raw_title}`);
                return false;
            }
        }

        const brandFound = titleUpper.includes(brandUpper);

        const modelFirstWord = modelUpper.split(' ')[0];
        const modelFound = modelFirstWord.length > 2 && titleUpper.includes(modelFirstWord);

        const signatures = BRAND_MODEL_SIGNATURES[brandUpper] || [];
        const signatureFound = signatures.some(sig => titleUpper.includes(sig.toUpperCase()));

        if (!brandFound && !modelFound && !signatureFound) {
            console.log(`[Agent 3 - Semantic] REJECTED (Wrong Brand): ${rawItem.raw_title}`);
            return false;
        }

        console.log(`[Agent 3 - Semantic] PASSED: ${rawItem.raw_title}`);
        return true;
    }
}

module.exports = new SemanticValidator();
