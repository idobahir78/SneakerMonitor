require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL: GEMINI_API_KEY is missing from environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// The brands we want to build a taxonomy for
const TARGET_BRANDS = [
    "Nike",
    "Adidas",
    "Puma",
    "New Balance",
    "Asics",
    "Hoka",
    "On Running",
    "Saucony",
    "Air Jordan"
];

const TAXONOMY_PATH = path.join(__dirname, 'frontend', 'src', 'data', 'sneaker_models.json');

async function generateTaxonomy() {
    console.log("🚀 Starting AI Sneaker Taxonomy Generation (Iterative)...");
    const taxonomy = { brands: [] };

    for (const brand of TARGET_BRANDS) {
        console.log(`\n🧠 Querying Gemini API for ${brand}...`);

        const prompt = `
        I need a database of sneaker and running shoe models for an e-commerce platform.
        
        Target Brand: ${brand}

        CRITICAL INSTRUCTIONS:
        1. Provide up to 70 of their most popular, well-known shoe lines across EVERY sport category (Sneakers, Basketball, Soccer/Football cleats, Running, Tennis, Training).
        2. Specifically ensure you include signature athlete lines (e.g. Puma MB, Nike LeBron) and iconic sports cleats (e.g. Nike Mercurial, Adidas Predator).
        3. ABSOLUTELY DO NOT INCLUDE: Flip-flops, slides, sandals, boots, slippers, t-shirts, pants, bags, hats, or any clothing/accessories.
        4. Do not include the brand name in the model string (e.g., return "Dunk Low" instead of "Nike Dunk Low").
        5. Clean strings. No weird characters.
        
        You MUST return the data EXACTLY in this JSON format:
        {
          "brand_name": "${brand}",
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
                console.warn(`⚠️ JSON Parse failed for ${brand}, attempting regex extraction...`);
                // Fallback: If JSON is truncated, extract what models we can using Regex
                const extractedModels = [...responseText.matchAll(/"([^"]+)"/g)]
                    .map(m => m[1])
                    .filter(m => m !== brand && m !== "brand_name" && m !== "models");

                brandData = {
                    brand_name: brand,
                    models: extractedModels
                };
            }

            if (brandData && brandData.models) {
                taxonomy.brands.push(brandData);
                console.log(`✅ Extracted ${brandData.models.length} models for ${brand}`);
            } else {
                console.error(`❌ Found no models for ${brand}`);
            }

            // Wait 2s to not hit rate limits on free tier
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (e) {
            console.error(`❌ Failed to extract for ${brand}:`, e.message);
        }
    }

    // Ensure path exists
    const dir = path.dirname(TAXONOMY_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2), 'utf-8');

    console.log(`\n🎯 Successfully generated and saved global taxonomy to ${TAXONOMY_PATH}`);

    // Print stats
    let total = 0;
    taxonomy.brands.forEach(b => {
        total += b.models.length;
    });
    console.log(`📊 Total curated sneaker models tracked globally: ${total}`);
}

generateTaxonomy();
