const crypto = require('crypto');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class VisualVerifier {
    constructor() {
        this.cacheFile = './vision_cache.json';
        this.cache = {};
        this.genAI = null;

        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }

        // Load simple file-based JSON cache if SQLite is overkill or unavailable
        if (fs.existsSync(this.cacheFile)) {
            try {
                this.cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
            } catch (e) {
                console.error('[VisualVerifier] Error parsing cache file, starting fresh.');
            }
        }
    }

    /**
     * Helper to create a unique hash for the image URL + Model combination
     */
    _getCacheKey(imageUrl, model) {
        return crypto.createHash('sha256').update(`${imageUrl}_${model}`).digest('hex');
    }

    _saveCache() {
        fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf8');
    }

    /**
     * Agent 4 Logic: Verifies if the image is actually the shoe using LLM Vision.
     * Includes caching to save costs on redundant API calls.
     */
    async verify(imageUrl, model) {
        if (!imageUrl) return false;

        const cacheKey = this._getCacheKey(imageUrl, model);

        // 1. Check Cache First (Cost Saving)
        if (this.cache.hasOwnProperty(cacheKey)) {
            console.log(`[Agent 4 - Visual] CACHE HIT for ${imageUrl} (Model: ${model}) -> ${this.cache[cacheKey]}`);
            return this.cache[cacheKey];
        }

        console.log(`[Agent 4 - Visual] CACHE MISS. Analyzing image: ${imageUrl}`);

        let isVerified = false;

        try {
            if (!this.genAI) {
                console.warn('[Agent 4 - Visual] Missing GEMINI_API_KEY, defaulting to true to avoid blocking.');
                isVerified = true;
            } else {
                // Fetch image buffer
                const response = await fetch(imageUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const base64Image = Buffer.from(arrayBuffer).toString('base64');
                const mimeType = response.headers.get('content-type') || 'image/jpeg';

                const modelGen = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

                const prompt = `Analyze this image. Is the primary commercial product shown a sports shoe or sneaker? Note that apparel items like hoodies, shirts, bags, or pants are NOT shoes, even if a person in the photo is wearing shoes. The main product must be a single shoe or pair of shoes. Reply with exactly 'YES' if it is a shoe, or 'NO' if it is apparel or not a shoe.`;

                const result = await modelGen.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType
                        }
                    }
                ]);

                const text = result.response.text().trim().toUpperCase();
                isVerified = text.includes('YES');
                console.log(`[Agent 4 - Visual] Gemini result: ${text} => ${isVerified}`);
            }
        } catch (error) {
            console.error(`[Agent 4 - Visual] API Error analyzing ${imageUrl}:`, error.message);
            // On API error, default to true depending on risk tolerance to prevent blocking all searches.
            isVerified = true;
        }

        // 2. Save result to Cache
        this.cache[cacheKey] = isVerified;
        this._saveCache();

        return isVerified;
    }
}

module.exports = new VisualVerifier();
