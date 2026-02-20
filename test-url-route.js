const url1 = 'https://www.terminalx.com/default-category/w595000013?color=70';
const url2 = 'https://www.terminalx.com/default-category/w595000013';

console.log('Testing:', url1);
fetch(url1, { redirect: 'manual' }).then(async res => {
    console.log(url1, res.status, res.headers.get('location'));
});

fetch(url2, { redirect: 'manual' }).then(async res => {
    console.log(url2, res.status, res.headers.get('location'));
});
