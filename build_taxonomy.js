const fs = require('fs');
const path = require('path');

const taxonomy = {
    brands: [
        {
            brand_name: "Nike",
            models: [
                "Air Force 1", "Air Force 1 High", "Air Force 1 Mid", "Air Force 1 Low",
                "Dunk Low", "Dunk High", "SB Dunk Low", "SB Dunk High", "SB Dunk Mid",
                "Air Max 1", "Air Max 90", "Air Max 95", "Air Max 97", "Air Max 98", "Air Max 200",
                "Air Max 270", "Air Max 720", "Air Max 2090", "Air Max Plus", "Air Max Dawn",
                "Blazer Low", "Blazer Mid", "Blazer Mid '77", "Cortez",
                "React Element 55", "React Element 87", "React Vision", "React Infinity Run",
                "Pegasus", "Pegasus Trail", "Air Zoom Pegasus 38", "Air Zoom Pegasus 39", "Air Zoom Pegasus 40",
                "Vomero", "Zoom Vomero 5", "Structure", "Winflo",
                "Vapormax", "Vapormax Plus", "Vapormax Flyknit", "Vapormax 2021",
                "Huarache", "Air Huarache",
                "Kyrie 1", "Kyrie 2", "Kyrie 3", "Kyrie 4", "Kyrie 5", "Kyrie 6", "Kyrie 7", "Kyrie Infinity",
                "LeBron 18", "LeBron 19", "LeBron 20", "LeBron 21", "LeBron Witness", "Zoom Soldier",
                "Kobe 4", "Kobe 5", "Kobe 6", "Kobe 8", "Kobe AD",
                "KD 13", "KD 14", "KD 15", "KD 16", "KD Trey 5",
                "Zoom Freak 1", "Zoom Freak 2", "Zoom Freak 3", "Zoom Freak 4",
                "PG 4", "PG 5", "PG 6",
                "Tiempo Legend", "Mercurial Superfly", "Mercurial Vapor", "Phantom GT", "Phantom GX", "Magista",
                "Metcon 6", "Metcon 7", "Metcon 8", "Metcon 9", "Free Metcon",
                "Air Presto", "Waffle One", "Space Hippie", "Terminator High"
            ]
        },
        {
            brand_name: "Adidas",
            models: [
                "Ultraboost", "Ultraboost 1.0", "Ultraboost 21", "Ultraboost 22", "Ultraboost Light",
                "NMD R1", "NMD V3", "NMD S1",
                "Yeezy Boost 350", "Yeezy Boost 350 V2", "Yeezy Boost 700", "Yeezy Boost 700 V2", "Yeezy 500", "Yeezy 380",
                "Yeezy Slide", "Yeezy Foam Runner", "Yeezy QNTM",
                "Superstar", "Stan Smith", "Forum Low", "Forum Mid", "Forum High", "Forum 84",
                "Gazelle", "Samba", "Samba OG", "Samba Classic", "Campus", "Campus 00s",
                "Ozelia", "Ozweego", "Astir", "Retropy E5", "ZX 2K Boost", "ZX 8000",
                "Predator Edge", "Predator Accuracy", "Predator Mutator", "X Speedportal", "X Crazyfast", "Copa Sense", "Copa Pure",
                "Adizero Adios Pro", "Adizero Boston", "Adizero Takumi Sen", "Adizero Prime X",
                "Solar Boost", "Supernova", "Duramo",
                "D Rose", "Harden Vol. 6", "Harden Vol. 7", "Dame 8", "Trae Young 1", "Trae Young 2", "Donovan Mitchell D.O.N. Issue"
            ]
        },
        {
            brand_name: "Puma",
            models: [
                "Suede", "Suede Classic", "Clyde", "Clyde Court", "Clyde All-Pro",
                "RS-X", "RS-X3", "RS-Dreamer", "RS-Z",
                "Future Rider", "Style Rider", "Cruise Rider",
                "MB.01", "MB.02", "MB.03", "LaMelo Ball",
                "King", "Future Z", "Future Ultimate", "Ultra Ultimate",
                "Deviate Nitro", "Deviate Nitro Elite", "Velocity Nitro", "Magnify Nitro", "ForeverRun Nitro",
                "Cali", "Cali Star", "Mayze", "Slipstream", "Trc Blaze"
            ]
        },
        {
            brand_name: "New Balance",
            models: [
                "990v1", "990v2", "990v3", "990v4", "990v5", "990v6",
                "991", "992", "993", "998", "999",
                "2002R", "1906R", "860v2",
                "550", "650", "650R",
                "574", "574 Core", "57/40",
                "327", "237", "XC-72",
                "Fresh Foam 1080", "Fresh Foam 1080v12", "Fresh Foam 1080v13", "Fresh Foam More", "Fresh Foam More v4", "Fresh Foam X 880", "Fresh Foam Hierro",
                "FuelCell Rebel", "FuelCell SC Elite", "FuelCell SC Trainer", "FuelCell Propel",
                "Kawhi", "Kawhi II", "TWO WXY", "TWO WXY V3", "TWO WXY V4",
                "Furon V7", "Tekela V4"
            ]
        },
        {
            brand_name: "Asics",
            models: [
                "Gel-Kayano", "Gel-Kayano 29", "Gel-Kayano 30", "Gel-Kayano 14",
                "Gel-Nimbus", "Gel-Nimbus 25", "Gel-Nimbus 26",
                "Gel-Cumulus", "Gel-Cumulus 25",
                "Gel-Kinsei", "Gel-Kinsei Blast",
                "Gel-Lyte III", "Gel-Lyte V", "Gel-1130", "Gel-NYC",
                "GT-2000", "GT-2000 11", "GT-2000 12", "GT-1000",
                "Novablast", "Novablast 3", "Novablast 4", "Superblast",
                "Metaspeed Sky", "Metaspeed Sky+", "Metaspeed Edge",
                "Gel-Resolution", "Gel-Resolution 8", "Gel-Resolution 9", "Court FF", "Court FF 3"
            ]
        },
        {
            brand_name: "Hoka",
            models: [
                "Clifton", "Clifton 8", "Clifton 9",
                "Bondi", "Bondi 8", "Bondi SR",
                "Mach", "Mach 5", "Mach X",
                "Speedgoat", "Speedgoat 5",
                "Arahi", "Arahi 6",
                "Gaviota", "Gaviota 4", "Gaviota 5",
                "Rincon", "Rincon 3",
                "Challenger", "Challenger 7", "Challenger ATR",
                "Torrent", "Torrent 3",
                "Carbon X", "Carbon X 3", "Rocket X", "Rocket X 2",
                "Mafate Speed", "Mafate Speed 4", "Kaha", "Kaha 2 GTX", "Anacapa", "Anacapa Low GTX", "Anacapa Mid GTX",
                "Hopara", "Transport"
            ]
        },
        {
            brand_name: "On Running",
            models: [
                "Cloud", "Cloud 5",
                "Cloudflow", "Cloudflow 4",
                "Cloudstratus", "Cloudstratus 3",
                "Cloudswift", "Cloudswift 3",
                "Cloudmonster", "Cloudmonster 2",
                "Cloudrunner",
                "Cloudsurfer",
                "Cloudventure", "Cloudventure Peak",
                "Cloudultra", "Cloudultra 2",
                "Cloudnova", "Cloudnova Form",
                "The Roger", "The Roger Advantage", "The Roger Centre Court", "The Roger Clubhouse", "The Roger Pro"
            ]
        },
        {
            brand_name: "Saucony",
            models: [
                "Kinvara", "Kinvara 13", "Kinvara 14", "Kinvara Pro",
                "Ride", "Ride 15", "Ride 16", "Ride 17",
                "Guide", "Guide 15", "Guide 16",
                "Triumph", "Triumph 20", "Triumph 21",
                "Endorphin Pro", "Endorphin Pro 3", "Endorphin Pro 4",
                "Endorphin Speed", "Endorphin Speed 3", "Endorphin Speed 4",
                "Endorphin Shift", "Endorphin Shift 3", "Endorphin Elite",
                "Peregrine", "Peregrine 12", "Peregrine 13",
                "Xodus", "Xodus Ultra", "Xodus Ultra 2",
                "Jazz", "Jazz Original", "Jazz 81",
                "Shadow 5000", "Shadow 6000",
                "Grid 9000", "Grid Web", "ProGrid Triumph 4"
            ]
        },
        {
            brand_name: "Air Jordan",
            models: [
                "Air Jordan 1 High", "Air Jordan 1 Mid", "Air Jordan 1 Low", "Air Jordan 1 Retro High OG",
                "Air Jordan 2", "Air Jordan 2 Retro", "Air Jordan 2 Low",
                "Air Jordan 3", "Air Jordan 3 Retro",
                "Air Jordan 4", "Air Jordan 4 Retro",
                "Air Jordan 5", "Air Jordan 5 Retro",
                "Air Jordan 6", "Air Jordan 6 Retro",
                "Air Jordan 7", "Air Jordan 7 Retro",
                "Air Jordan 8", "Air Jordan 8 Retro",
                "Air Jordan 11", "Air Jordan 11 Retro", "Air Jordan 11 Low",
                "Air Jordan 12", "Air Jordan 12 Retro",
                "Air Jordan 13", "Air Jordan 13 Retro",
                "Air Jordan 14",
                "Jordan Luka 1", "Jordan Luka 2",
                "Jordan Zion 1", "Jordan Zion 2", "Jordan Zion 3",
                "Jordan Tatum 1", "Jordan Tatum 2",
                "Jordan XXXVII", "Jordan XXXVIII"
            ]
        }
    ]
};

const JSON_PATH = path.join(__dirname, 'frontend', 'src', 'data', 'sneaker_models.json');

// Ensure directories exist
const dir = path.dirname(JSON_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Write the compiled taxonomy
fs.writeFileSync(JSON_PATH, JSON.stringify(taxonomy, null, 2), 'utf-8');

// Count total models
let totalModels = 0;
taxonomy.brands.forEach(b => {
    totalModels += b.models.length;
    console.log(`✅ Included ${b.models.length} definitive models for ${b.brand_name}`);
});

console.log(`\n🎯 Successfully compiled local Sneaker Taxonomy cache!`);
console.log(`📊 Total distinct sneaker models across all brands: ${totalModels}`);
console.log(`📁 File saved to: ${JSON_PATH}`);
