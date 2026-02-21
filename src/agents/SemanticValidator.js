const BRAND_MODEL_SIGNATURES = {
    'PUMA': ['MB.01', 'MB.02', 'MB.03', 'MB.04', 'MB.05', 'MB.06', 'CLYDE', 'RS-X', 'SUEDE'],
    'NIKE': ['DUNK', 'AIR MAX', 'AIR FORCE', 'JORDAN', 'BLAZER', 'CORTEZ', 'WAFFLE'],
    'ADIDAS': ['YEEZY', 'ULTRABOOST', 'NMD', 'STAN SMITH', 'SAMBA', 'GAZELLE', 'FORUM'],
    'NEW BALANCE': ['990', '992', '993', '550', '574', '327', '2002', '530', '9060'],
    'ASICS': ['GEL-LYTE', 'GEL-KAYANO', 'GEL-NIMBUS', 'GT-2000'],
};

const NON_SHOE_BLACKLIST = [
    'SANDAL', 'SLIDE', 'SLIDES', 'FLIP FLOP', 'FLIP-FLOP', 'CROCS',
    'BACKPACK', 'BAG', 'TEE', 'SHIRT', 'T-SHIRT', 'HOODIE', 'JACKET',
    'SHORTS', 'PANTS', 'HAT', 'CAP', 'SOCKS', 'SOCK',
    'סנדל', 'סנדלים', 'כפכף', 'כפכפים',
    'תיק', 'חולצה', 'טי שירט', 'מכנס', 'כובע', 'גרב', 'גרביים'
];

class SemanticValidator {
    constructor() { }

    _extractAllModelNumbers(text) {
        const numbers = [];
        const patterns = [
            /\b([A-Z]{1,4}[\s.-]?\d{2,4}(?:\.\d+)?)\b/g,
            /\b(\d{3,4}(?:\.\d+)?)\b/g,
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                numbers.push(match[1].replace(/[\s.-]/g, '').toUpperCase());
            }
        }
        return numbers;
    }

    _normalizeModelString(model) {
        return model.replace(/[\s.-]/g, '').toUpperCase();
    }

    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        console.log(`[Agent 3 - Semantic] Validation started for: ${rawItem.raw_title}`);

        await new Promise(resolve => setTimeout(resolve, 50));

        const titleUpper = rawItem.raw_title.toUpperCase();
        const contextUpper = (rawItem.full_context || '').toUpperCase();
        const combinedText = titleUpper + ' ' + contextUpper;
        const brandUpper = brand.toUpperCase();
        const modelUpper = (model || '').toUpperCase().trim();
        const normalizedTargetModel = this._normalizeModelString(modelUpper);

        for (const keyword of NON_SHOE_BLACKLIST) {
            if (titleUpper.includes(keyword.toUpperCase())) {
                console.log(`[Agent 3 - Semantic] REJECTED (Non-Shoe: "${keyword}"): ${rawItem.raw_title}`);
                return false;
            }
        }

        const junkKeywords = ['LACES', 'BOX ONLY', 'CLEAN KIT', 'CLEANING KIT', 'INSOLE', 'KEEPER'];
        if (junkKeywords.some(k => titleUpper.includes(k))) {
            const shoeKeywords = ['SHOE', 'SNEAKER', 'BOOT', 'TRAINER', 'נעל', 'סניקר', 'כדורסל'];
            if (!shoeKeywords.some(k => titleUpper.includes(k))) {
                console.log(`[Agent 3 - Semantic] REJECTED (Accessory/Junk): ${rawItem.raw_title}`);
                return false;
            }
        }

        if (modelUpper) {
            const titleNumbers = this._extractAllModelNumbers(titleUpper);
            const contextNumbers = this._extractAllModelNumbers(contextUpper);
            const allFoundNumbers = [...titleNumbers, ...contextNumbers];

            const targetHasNumber = /\d{2,}/.test(normalizedTargetModel);

            if (targetHasNumber) {
                const targetNumericPart = normalizedTargetModel.replace(/[^0-9]/g, '');

                const exactMatch = allFoundNumbers.some(n => {
                    const nNumeric = n.replace(/[^0-9]/g, '');
                    return nNumeric === targetNumericPart || n === normalizedTargetModel;
                });

                const directTextMatch = combinedText.includes(modelUpper) ||
                    combinedText.includes(normalizedTargetModel) ||
                    combinedText.includes(modelUpper.replace(/\./g, ' '));

                if (!exactMatch && !directTextMatch) {
                    const wrongModels = allFoundNumbers
                        .filter(n => /\d{2,}/.test(n))
                        .filter(n => n.replace(/[^0-9]/g, '') !== targetNumericPart);

                    if (wrongModels.length > 0) {
                        console.log(`[Agent 3 - Semantic] REJECTED (Model Mismatch: Found ${wrongModels[0]}, Expected ${modelUpper}): ${rawItem.raw_title}`);
                        return false;
                    }

                    if (!brandUpper || !combinedText.includes(brandUpper)) {
                        console.log(`[Agent 3 - Semantic] REJECTED (Model "${modelUpper}" not found): ${rawItem.raw_title}`);
                        return false;
                    }
                }
            } else {
                const modelWords = modelUpper.split(/\s+/).filter(w => w.length > 1);
                const modelFoundInText = modelWords.every(w => combinedText.includes(w));
                if (!modelFoundInText) {
                    const brandFound = combinedText.includes(brandUpper);
                    const signatures = BRAND_MODEL_SIGNATURES[brandUpper] || [];
                    const signatureFound = signatures.some(sig => combinedText.includes(sig.toUpperCase()));
                    if (!brandFound && !signatureFound) {
                        console.log(`[Agent 3 - Semantic] REJECTED (Wrong Brand): ${rawItem.raw_title}`);
                        return false;
                    }
                }
            }
        } else {
            const brandFound = combinedText.includes(brandUpper);
            if (!brandFound) {
                console.log(`[Agent 3 - Semantic] REJECTED (Wrong Brand): ${rawItem.raw_title}`);
                return false;
            }
        }

        if (contextUpper && !titleUpper.includes(modelUpper) && contextUpper.includes(modelUpper)) {
            console.log(`[Agent 3 - Semantic] PASSED (Model found in full_context fallback): ${rawItem.raw_title}`);
            return true;
        }

        console.log(`[Agent 3 - Semantic] PASSED: ${rawItem.raw_title}`);
        return true;
    }
}

module.exports = new SemanticValidator();
