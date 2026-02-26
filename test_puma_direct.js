const fs = require('fs');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache'
};

const SITES = [
    {
        name: 'Puma Israel',
        urls: [
            'https://puma.co.il/',
            'https://puma.co.il/search?q=MB.05',
            'https://puma.co.il/search?type=product&q=MB.05',
            'https://puma.co.il/pages/search-results?q=MB.05',
            'https://puma.co.il/collections/all?q=MB.05',
            'https://puma.co.il/search?q=MB.05&type=product',
            'https://www.puma.co.il/',
            'https://www.puma.co.il/search?q=MB.05',
            'https://www.puma.co.il/catalogsearch/result/?q=MB.05',
        ]
    },
    {
        name: 'Mayers',
        urls: [
            'https://www.mayers.co.il/',
            'https://www.mayers.co.il/search?q=puma&type=product',
            'https://www.mayers.co.il/search?q=puma',
            'https://www.mayers.co.il/pages/search-results?q=puma',
            'https://www.mayers.co.il/collections/all?q=puma',
        ]
    },
    {
        name: 'KICKS',
        urls: [
            'https://kicks.co.il/',
            'https://kicks.co.il/?s=puma&post_type=product',
            'https://www.kicks.co.il/',
            'https://www.kicks.co.il/?s=puma&post_type=product',
        ]
    },
    {
        name: 'Foot Locker Israel',
        urls: [
            'https://www.footlocker.co.il/',
            'https://www.footlocker.co.il/search?q=puma',
            'https://www.footlocker.co.il/catalogsearch/result/?q=puma',
        ]
    }
];

async function testUrl(name, url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            method: 'GET',
            headers: HEADERS,
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timeout);

        const body = await response.text();
        const hasProducts = body.includes('product') || body.includes('item');
        const hasBlock = body.includes('Access Denied') || body.includes('captcha') || body.includes('blocked');
        const hasSearch = body.includes('search') || body.includes('results');

        const status = response.status === 200 ? '✅' : response.status === 301 || response.status === 302 ? '➡️' : '❌';

        console.log(`  ${status} [${response.status}] ${url}`);
        console.log(`     Body: ${body.length} chars | Server: ${response.headers.get('server') || 'N/A'} | Final: ${response.url}`);
        if (body.length > 0 && body.length < 500) {
            console.log(`     Preview: ${body.substring(0, 200).replace(/\n/g, ' ')}`);
        }
        if (hasBlock) console.log(`     ⚠️  Block indicators detected`);
        if (response.status === 200 && body.length > 1000) {
            // Save the first successful page for each site
            const safeName = name.replace(/\s+/g, '_').toLowerCase();
            const safeUrl = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            fs.writeFileSync(`diag_${safeName}_${response.status}.html`, body.substring(0, 10000), 'utf8');
            console.log(`     💾 Saved to diag_${safeName}_${response.status}.html`);
        }

        return { url, status: response.status, bodyLen: body.length, finalUrl: response.url };
    } catch (err) {
        console.log(`  ❌ [ERR] ${url}`);
        console.log(`     ${err.message}`);
        return { url, status: 'error', error: err.message };
    }
}

async function runDiagnostic() {
    console.log('='.repeat(70));
    console.log('MULTI-SITE URL DISCOVERY DIAGNOSTIC');
    console.log(`Time: ${new Date().toISOString()} | Node: ${process.version}`);
    console.log('='.repeat(70));

    for (const site of SITES) {
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`🔍 ${site.name}`);
        console.log(`${'─'.repeat(50)}`);

        for (const url of site.urls) {
            await testUrl(site.name, url);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(70));
}

runDiagnostic();
