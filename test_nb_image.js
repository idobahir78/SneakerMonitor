const fs = require('fs');
fs.writeFileSync('test_img.html', `
<html>
<head><title>Test Hotlink</title></head>
<body>
<h1>Testing NB Israel Image Hotlink</h1>
<img src="https://www.newbalance.co.il/dw/image/v2/BFQM_PRD/on/demandware.static/-/Sites-nb-storefront-catalog/default/dw18be2e0f/images/U574/u574lgg1_2.jpg?sw=400&sh=400&sm=fit" 
     id="testimg" />
</body></html>
`);

const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const filePath = 'file://' + __dirname + '/test_img.html';

    // Listen to network responses
    page.on('response', response => {
        if (response.request().resourceType() === 'image') {
            console.log('Image status:', response.status());
        }
    });

    await page.goto(filePath, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const isLoaded = await page.evaluate(() => {
        const img = document.getElementById('testimg');
        return img.complete && img.naturalHeight !== 0;
    });

    console.log('Image successfully loaded in browser?', isLoaded);
    await browser.close();
})();
