const NON_SHOE_BLACKLIST = [
    'SANDAL', 'SLIDE', 'SLIDES', 'FLIP FLOP', 'FLIP-FLOP', 'CROCS',
    'BACKPACK', 'BAG', 'TEE', 'SHIRT', 'T-SHIRT', 'HOODIE', 'JACKET',
    'SHORTS', 'PANTS', 'HAT', 'CAP', 'SOCKS', 'SOCK', 'INSOLE', 'מדרסים',
    'סנדל', 'סנדלים', 'כפכף', 'כפכפים',
    'תיק', 'חולצה', 'טי שירט', 'טישרט', 'מכנס', 'כובע', 'גרב', 'גרביים'
];

const JUNK_KEYWORDS = ['LACES', 'BOX ONLY', 'CLEAN KIT', 'CLEANING KIT', 'INSOLE', 'KEEPER', 'מדרסים'];
const SHOE_KEYWORDS = ['SHOE', 'SNEAKER', 'SNEAKERS', 'BOOT', 'TRAINER', 'TRAINERS', 'נעל', 'נעלי', 'סניקר', 'כדורסל'];

class SemanticValidator {
    constructor() { }

    _detectGenderIntent(brand, model) {
        const fullQuery = `${brand} ${model}`.toUpperCase();
        // Allow common Hebrew prefixes like ל, ב, ה
        const menRegex = /(^|[^א-תa-zA-Z0-9]|[לבה])(MEN|M|גברים|גבר)([^א-תa-zA-Z0-9]|$)/i;
        const womenRegex = /(^|[^א-תa-zA-Z0-9]|[לבה])(WOMEN|W|נשים|אישה)([^א-תa-zA-Z0-9]|$)/i;

        if (menRegex.test(fullQuery)) return 'MEN';
        if (womenRegex.test(fullQuery)) return 'WOMEN';
        return 'UNISEX';
    }

    /**
     * Checks if the title/context matches the gender intent
     */
    _genderMatch(intent, text) {
        if (intent === 'UNISEX') return true;
        const textUpper = text.toUpperCase();

        const menRegex = /(^|[^א-תa-zA-Z0-9]|[לבה])(MEN|M|גברים|גבר)([^א-תa-zA-Z0-9]|$)/i;
        const womenRegex = /(^|[^א-תa-zA-Z0-9]|[לבה])(WOMEN|W|נשים|אישה|WNS)([^א-תa-zA-Z0-9]|$)/i;

        if (intent === 'MEN') {
            const hasMenToken = menRegex.test(textUpper);
            const hasWomenToken = womenRegex.test(textUpper);
            // Match if it explicitly says Men OR if it doesn't mention Women at all
            return hasMenToken || !hasWomenToken;
        }

        if (intent === 'WOMEN') {
            return womenRegex.test(textUpper);
        }

        return true;
    }

    _getCoreModel(modelStr) {
        const knownBrandWords = ['BALANCE', 'CLOUD', 'RUNNING', 'SPORT', 'SHOES', 'SNEAKER', 'HOKA', 'NIKE', 'ADIDAS'];
        const words = modelStr.toUpperCase().trim().split(/\s+/);
        if (words.length > 1 && knownBrandWords.includes(words[0])) {
            return words.slice(1).join(' ');
        }
        return modelStr.toUpperCase().trim();
    }

    _coreNumberMatch(coreModel, text) {
        const textUpper = text.toUpperCase();
        const cleanCore = coreModel.replace(/\b(MEN|WOMEN|M|W|גברים|נשים)\b/gi, '').trim();
        if (!cleanCore) return true;

        if (textUpper.includes(cleanCore)) return true;

        const numMatch = cleanCore.match(/(\d{2,4}(?:\.\d+)?)/);
        if (!numMatch) return textUpper.includes(cleanCore);

        const coreNum = numMatch[1].replace('.', '\\.');
        const pattern = new RegExp(`(^|\\b|[A-Z]{1,4})(${coreNum})([A-Z0-9]*)?($|\\b)`, 'i');
        return pattern.test(textUpper);
    }

    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        const title = rawItem.raw_title;
        const titleUpper = title.toUpperCase();
        const contextUpper = (rawItem.full_context || '').toUpperCase();
        const combinedText = titleUpper + ' ' + contextUpper;
        const brandUpper = (brand || '').toUpperCase().trim();

        const genderIntent = (targetSize === '*') ? 'UNISEX' : this._detectGenderIntent(brand, model);
        const cleanModel = this._getCoreModel(model || '');

        console.log(`[Agent 3 - Semantic] Checking: "${title}" | Intent: ${genderIntent} | Model: ${cleanModel}`);

        // === RULE 1: Blacklist (Expanded) ===
        for (const keyword of NON_SHOE_BLACKLIST) {
            if (titleUpper.includes(keyword.toUpperCase())) {
                console.log(`[Agent 3 - Semantic] REJECTED (Blacklist "${keyword}"): ${title}`);
                return false;
            }
        }

        // === RULE 2: Junk/Accessory Filter ===
        if (JUNK_KEYWORDS.some(k => titleUpper.includes(k))) {
            if (!SHOE_KEYWORDS.some(k => titleUpper.includes(k))) {
                console.log(`[Agent 3 - Semantic] REJECTED (Accessory/Junk): ${title}`);
                return false;
            }
        }

        // === RULE 3: Gender Validation ===
        if (!this._genderMatch(genderIntent, combinedText)) {
            console.log(`[Agent 3 - Semantic] REJECTED (Gender Mismatch: Expected ${genderIntent}): ${title}`);
            return false;
        }

        // === RULE 4: Exclusive Model Match ===
        if (cleanModel && cleanModel.length > 1) {
            let modelFoundInTitle = this._coreNumberMatch(cleanModel, titleUpper);
            let modelFoundInContext = this._coreNumberMatch(cleanModel, contextUpper);

            // Edge Case: Factory 54 translates "Puma MB.05 Fast & Furious" as "פומה X מהיר ועצבני" without "MB.05"
            if (cleanModel === 'MB.05' && (combinedText.includes('מהיר ועצבני') || combinedText.includes('FAST & FURIOUS') || combinedText.includes('LAFRANCE'))) {
                modelFoundInTitle = true;
            }

            if (!modelFoundInTitle && !modelFoundInContext) {
                console.log(`[Agent 3 - Semantic] REJECTED (Model "${cleanModel}" not found): ${title}`);
                return false;
            }
        } else {
            if (brandUpper && !combinedText.includes(brandUpper)) {
                console.log(`[Agent 3 - Semantic] REJECTED (Brand "${brand}" not found): ${title}`);
                return false;
            }
        }

        console.log(`[Agent 3 - Semantic] PASSED: ${title}`);
        return true;
    }
}

module.exports = new SemanticValidator();
