require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL: GEMINI_API_KEY is missing from environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b"
];
let currentModelIndex = 0;

function getNextModel() {
    const modelName = MODELS[currentModelIndex];
    currentModelIndex = (currentModelIndex + 1) % MODELS.length;
    console.log('[System] Switching to model: ' + modelName);
    return genAI.getGenerativeModel({ model: modelName });
}
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
        I need a COMPREHENSIVE database of sneaker and running shoe models for an e - commerce platform.
        
        Target Brand: ${brand}

        CRITICAL INSTRUCTIONS:
    1. Provide AT LEAST 80 to 120 of their most popular, well - known, and historical shoe lines across EVERY sport category(Sneakers, Basketball, Soccer / Football cleats, Running, Tennis, Training, Lifestyle).
        2. Be EXHAUSTIVE for ' + brand + '. DO NOT stop at just 15 or 20 models.If ' + brand + ' is Adidas, include all Ultraboost variations, NMDs, Yeezys(if applicable), Predator, X, Copa, Stan Smith, Superstar, Forum, Gazelle, Samba, etc.If it is New Balance, include all 990v variations, 574, 327, 2002R, 550, Fresh Foam, FuelCell, etc.If it is Puma, include all RS series, Clyde, Suede, Future, Ultra, King, etc.YOU MUST PROVIDE A MASSIVE LIST FOR EVERY BRAND.
        3. Specifically ensure you include signature athlete lines and iconic sports cleats.
        4. ABSOLUTELY DO NOT INCLUDE: Flip - flops, slides, sandals, boots, slippers, t - shirts, pants, bags, hats, or any clothing / accessories.
        5. Do not include the brand name in the model string(e.g., return "Dunk Low" instead of "Nike Dunk Low").
        
        You MUST return the data EXACTLY as plain text.Group by categories.Use commas between items.Do not use bullets.
        `;

        try {
            const model = getNextModel();
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "text/plain",
                    temperature: 0.8,
                    maxOutputTokens: 2048
                }
            });

            let responseText = result.response.text().trim();

            let cleanText = responseText
                .replace(/([a-zA-Z]+:)/g, ',') // remove "Basketball:" type strings
                .replace(/\n|•|-/g, ',')
                .replace(/[^a-zA-Z0-9\s,.-]/g, ''); // stip special chars except valid shoe name parts like dash or dot

            let modelsArray = cleanText
                .split(',')
                .map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''))
                .filter(s => s.length > 2 && s.toLowerCase() !== brand.toLowerCase() && !s.toLowerCase().includes('sure') && !s.toLowerCase().includes('here is') && !s.toLowerCase().includes('model'));

            // Deduplicate
            modelsArray = [...new Set(modelsArray)];

            if (modelsArray.length > 0) {
                taxonomy.brands.push({ brand_name: brand, models: modelsArray });
                console.log('✅ Extracted ' + modelsArray.length + ' models for ' + brand);
            } else {
                console.error('❌ Found no models for ' + brand);
            }

            // Wait 10s to not hit rate limits on free tier
            await new Promise(resolve => setTimeout(resolve, 10000));

        } catch (e) {
            console.error('❌ Failed to extract for ' + brand + ': ', e.message);
        }
    }

    // Ensure path exists
    const dir = path.dirname(TAXONOMY_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2), 'utf-8');

    console.log('\\n🎯 Successfully generated and saved global taxonomy to ' + TAXONOMY_PATH);

    // Print stats
    let total = 0;
    taxonomy.brands.forEach(b => {
        total += b.models.length;
    });
    console.log('📊 Total curated sneaker models tracked globally: ' + total);
}

generateTaxonomy();
