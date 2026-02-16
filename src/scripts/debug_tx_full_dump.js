const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    console.log('🚀 Dumping Terminal X Puma Products...');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const url = 'https://www.terminalx.com/brands/puma';

    // Store all raw names found
    const rawNames = new Set();

    page.on('response', async (response) => {
        try {
            const text = await response.text();
            if (text.includes('"items":') && text.includes('"name":')) {
                const regex = /"name":"(.*?)"/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (!match[1].includes('http') && !match[1].includes('{')) {
                        rawNames.add(match[1]);
                    }
                }
            }
        } catch (e) { }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll deep
    await page.evaluate(async () => {
        for (let i = 0; i < 10; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise(r => setTimeout(r, 1000));
        }
    });

    await new Promise(r => setTimeout(r, 5000));

    await browser.close();

    const sorted = Array.from(rawNames).sort();
    fs.writeFileSync('tx_puma_dump.txt', sorted.join('\n'));
    console.log(`\nSaved ${sorted.length} raw product names to tx_puma_dump.txt`);

    // Quick check for keywords
    const keywords = ['MB', 'Melo', '04', 'Rick', 'Morty', 'Dexter'];
    console.log('\n--- Keyword Check ---');
    keywords.forEach(kw => {
        const found = sorted.filter(n => n.includes(kw));
        console.log(`"${kw}": ${found.length} matches`);
        if (found.length > 0) console.log(found.slice(0, 3));
    });

})();
