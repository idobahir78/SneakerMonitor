const p = require('./tx-rejected.json');
console.log(JSON.stringify(p, null, 2).substring(0, 1000));
const urls = [];
JSON.stringify(p, (k, v) => {
    if (typeof v === 'string' && v.includes('terminalx.com') && !v.includes('.jpg')) {
        urls.push(k + ': ' + v);
    }
    return v;
});
console.log(urls);
