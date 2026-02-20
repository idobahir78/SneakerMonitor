const sku = 'W595000013';
const p1 = `https://www.terminalx.com/${sku}.html`;
const p2 = `https://www.terminalx.com/catalogsearch/result/?q=${sku}`;
console.log('Testing:', p1);
fetch(p1, { redirect: 'manual' }).then(res => {
    console.log(p1, res.status, res.headers.get('location'));
});
fetch(p2, { redirect: 'manual' }).then(res => {
    console.log(p2, res.status, res.headers.get('location'));
});
