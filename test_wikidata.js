const https = require('https');

console.log("Testing Wikidata SPARQL for Sneaker Taxonomy...");

// Query Wikidata for shoes (Q22676) or sneakers (Q755913) where manufacturer is Nike (Q46422), Adidas (Q164103), Puma (Q157064).
const sparql = `
SELECT ?item ?itemLabel ?brandLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q22676. 
  ?item wdt:P176|wdt:P1716 ?brand.
  FILTER (?brand IN (wd:Q46422, wd:Q164103, wd:Q157064)).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`;

const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json';

const req = https.get(url, { headers: { 'User-Agent': 'SneakerMonitor/1.0 (idobahir78)' } }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(body);
            const bindings = json.results.bindings;
            console.log('Wikidata returned', bindings.length, 'shoes totally.');

            const names = bindings.map(b => b.itemLabel.value.toLowerCase());
            console.log("Has Kobe?", names.some(n => n.includes('kobe')));
            console.log("Has KD?", names.some(n => n.includes('kd')));
            console.log("Has Puma MB?", names.some(n => n.includes('mb.0') || n.includes('melo')));

            if (bindings.length > 0) {
                console.log("Sample:", bindings.slice(0, 5).map(b => b.itemLabel.value));
            }
        } catch (e) {
            console.log('Error parsing Wikidata', e.message);
        }
    });
});
