const https = require('https');
const fs = require('fs');

const url = 'https://www.alufsport.co.il/?s=Nike&post_type=product';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        fs.writeFileSync('aluf_debug.html', data);
        console.log('HTML saved to aluf_debug.html');
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
