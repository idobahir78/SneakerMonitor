const p = require('./tx-rejected.json');
const paths = [];

function findKey(obj, targetKey, currentPath) {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        if (key === targetKey || key === 'url') {
            paths.push(`${newPath} = ${obj[key]}`);
        }
        findKey(obj[key], targetKey, newPath);
    }
}

findKey(p, 'url_key', '');
console.log(paths.join('\n'));
