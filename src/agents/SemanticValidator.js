const NON_SHOE_BLACKLIST = [
    'SANDAL', 'SLIDE', 'SLIDES', 'FLIP FLOP', 'FLIP-FLOP', 'CROCS',
    'BACKPACK', 'BAG', 'TEE', 'SHIRT', 'T-SHIRT', 'HOODIE', 'JACKET',
    'SHORTS', 'PANTS', 'HAT', 'CAP', 'SOCKS', 'SOCK',
    'סנדל', 'סנדלים', 'כפכף', 'כפכפים',
    'תיק', 'חולצה', 'טי שירט', 'מכנס', 'כובע', 'גרב', 'גרביים'
];

const JUNK_KEYWORDS = ['LACES', 'BOX ONLY', 'CLEAN KIT', 'CLEANING KIT', 'INSOLE', 'KEEPER'];
const SHOE_KEYWORDS = ['SHOE', 'SNEAKER', 'BOOT', 'TRAINER', 'נעל', 'סניקר', 'כדורסל'];

// Gender/version prefixes that wrap around model numbers
// e.g., "MR530", "U530", "WL530", "W9060", "M990" — the core number is the model
const SIZE_PREFIXES = /^(MR|ML|WR|WL|GS|GC|PS|TD|M|W|U|X|V|J|Y|GY|BB|BQ|CQ|GS|FQ|DH|DV|HF|DZ|DM|FZ|SB|DC|DD|FD|FN|FQ|HJ|HN|DQ|FV|HC|HD|JF|JH|JJ|JM|JN|JQ|JR|JS|JT|JV|JW|JZ|KC|KD|KF|KH|KJ|KK|KL|KM|KN|KQ|KR|KS|KT|KV|KW|KZ|LC|LD|LF|LH|LJ|LK|LL|LM|LN|LQ|LR|LS|LT|LV|LW|LZ)/i;

class SemanticValidator {
    constructor() { }

    /**
     * Extract the "core" model number from a model string.
     * Strips brand words that may have leaked into the model field.
     * e.g., "Balance 530" → "530", "Cloud X" → "Cloud X" (no numeric core)
     */
    _getCoreModel(modelStr) {
        // If the model starts with a brand name (leaked from bad split), strip it
        const knownBrandWords = ['BALANCE', 'CLOUD', 'RUNNING', 'SPORT', 'SHOES', 'SNEAKER'];
        const words = modelStr.toUpperCase().trim().split(/\s+/);
        // If first word is a brand-like word and remaining words are a model, use rest
        if (words.length > 1 && knownBrandWords.includes(words[0])) {
            return words.slice(1).join(' ');
        }
        return modelStr.toUpperCase().trim();
    }

    /**
     * Check if a core model number exists in the text.
     * Handles prefix variants: "530" matches "MR530", "U530", "530v2", "W530EA" etc.
     */
    _coreNumberMatch(coreModel, text) {
        const textUpper = text.toUpperCase();

        // Direct substring: "530" in "MR530" or "530 Sneakers"
        if (textUpper.includes(coreModel)) return true;

        // Extract numeric part from coreModel (e.g., "530" → "530", "MB.05" → "05")
        const numMatch = coreModel.match(/(\d{2,4}(?:\.\d+)?)/);
        if (!numMatch) return false;
        const coreNum = numMatch[1].replace('.', '\\.');

        // Pattern: optional prefix letters + core number + optional suffix
        const pattern = new RegExp(
            `(^|\\b|[A-Z]{1,4})(${coreNum})([A-Z0-9]*)?($|\\b)`,
            'i'
        );
        return pattern.test(textUpper);
    }

    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        const title = rawItem.raw_title;
        const titleUpper = title.toUpperCase();
        const contextUpper = (rawItem.full_context || '').toUpperCase();
        const brandUpper = (brand || '').toUpperCase().trim();

        // Derive clean model — strip brand words that leaked from bad CLI split
        const cleanModel = this._getCoreModel(model || '');

        console.log(`[Agent 3 - Semantic] Checking: "${title}" | Target: brand="${brand}" model="${cleanModel}" (raw="${model}")`);

        // === RULE 1: Non-Shoe Blacklist ===
        for (const keyword of NON_SHOE_BLACKLIST) {
            if (titleUpper.includes(keyword.toUpperCase())) {
                console.log(`[Agent 3 - Semantic] REJECTED (Non-Shoe "${keyword}"): ${title}`);
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

        // === RULE 3: Exclusive Model Match ===
        if (cleanModel) {
            const modelFoundInTitle = this._coreNumberMatch(cleanModel, titleUpper);
            const modelFoundInContext = this._coreNumberMatch(cleanModel, contextUpper);

            if (!modelFoundInTitle && !modelFoundInContext) {
                // Find any other model identifiers in title for diagnostic logging
                const otherModels = [...titleUpper.matchAll(/\b([A-Z]{0,4}\d{3,4}[A-Z0-9.]*)\b/g)]
                    .map(m => m[1])
                    .filter(m => !m.includes(cleanModel.replace(/\D/g, '')));
                if (otherModels.length > 0) {
                    console.log(`[Agent 3 - Semantic] REJECTED (Model Mismatch: Found "${otherModels[0]}", Expected "${cleanModel}"): ${title}`);
                } else {
                    console.log(`[Agent 3 - Semantic] REJECTED (Model "${cleanModel}" not found): ${title}`);
                }
                return false;
            }

            if (modelFoundInContext && !modelFoundInTitle) {
                console.log(`[Agent 3 - Semantic] PASSED (model "${cleanModel}" found in context): ${title}`);
                return true;
            }
        } else {
            // No model — require brand at minimum
            if (brandUpper && !(titleUpper.includes(brandUpper) || contextUpper.includes(brandUpper))) {
                console.log(`[Agent 3 - Semantic] REJECTED (Brand "${brand}" not found): ${title}`);
                return false;
            }
        }

        console.log(`[Agent 3 - Semantic] PASSED: ${title}`);
        return true;
    }
}

module.exports = new SemanticValidator();
