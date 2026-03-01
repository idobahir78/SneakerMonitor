const https = require('https');

const options = {
    hostname: 'www.nike.com',
    path: '/',
    method: 'GET',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        if (res.statusCode === 403) {
            console.log('BLOCKED BY BOT PROTECTION!');
            let sample = body.substring(0, 150).replace(/\n/g, '');
            console.log('Response content:', sample);
        } else {
            console.log('Successfully connected. Bytes:', body.length);
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
