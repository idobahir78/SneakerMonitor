const p = require('./tx-rejected.json');
const keys = new Set();
JSON.stringify(p, (k, v) => {
    if (k.toLowerCase().includes('url')) keys.add(k);
    return v;
});
console.log([...keys].join(', '));
