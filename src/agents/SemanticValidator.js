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
