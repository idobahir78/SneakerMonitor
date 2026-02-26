require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TAXONOMY_PATH = path.join(__dirname, 'frontend', 'src', 'data', 'sneaker_models.json');

async function fixPuma() {
    console.log("🧠 Querying Gemini API specifically for Puma to fix missing MB series...");

    const prompt = `
    I need a database of sneaker and running shoe models for an e-commerce platform.
    
    Target Brand: Puma

    CRITICAL INSTRUCTIONS:
    1. Provide up to 50 of their most popular, well-known sneaker lines, basketball shoes, signature lines, and performance running shoes.
    2. Specifically ensure you include signature athlete lines (e.g. Puma MB LaMelo Ball series) and their basketball shoes.
    3. ABSOLUTELY DO NOT INCLUDE: Flip-flops, slides, sandals, boots, slippers, t-shirts, pants, bags, hats, or any clothing/accessories.
    4. Do not include the brand name in the model string (e.g., return "MB.03" instead of "Puma MB.03").
    5. Clean strings. No weird characters.
    
    You MUST return the data EXACTLY in this JSON format:
    {
      "brand_name": "Puma",
      "models": ["Model 1", "Model 2", "Model 3"]
    }
    
    DO NOT RETURN ANYTHING OTHER THAN VALID JSON. No markdown backticks.
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
                maxOutputTokens: 2048
            }
        });

        let responseText = result.response.text();
        responseText = responseText.trim();
        if (responseText.startsWith('\`\`\`json')) {
            responseText = responseText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
        }

        let brandData;
        try {
            brandData = JSON.parse(responseText);
        } catch (err) {
            console.warn(`⚠️ JSON Parse failed for Puma, attempting regex extraction...`);
            const extractedModels = [...responseText.matchAll(/"([^"]+)"/g)]
                .map(m => m[1])
                .filter(m => m !== "Puma" && m !== "brand_name" && m !== "models");

            brandData = {
                brand_name: "Puma",
                models: extractedModels
            };
        }

        if (brandData && brandData.models && brandData.models.length > 0) {
            // Load existing taxonomy
            const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf-8'));

            // Overwrite Puma array
            const pumaIndex = taxonomy.brands.findIndex(b => b.brand_name === 'Puma');
            if (pumaIndex !== -1) {
                taxonomy.brands[pumaIndex] = brandData;
            } else {
                taxonomy.brands.push(brandData);
            }

            fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2), 'utf-8');
            console.log(`✅ Successfully injected ${brandData.models.length} Puma models including MB series.`);
        } else {
            console.error(`❌ Found no models for Puma`);
        }
    } catch (e) {
        console.error(`❌ API Failed:`, e.message);
    }
}

fixPuma();
