
const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('stockx_debug.html', 'utf8');
const $ = cheerio.load(html);

const nextDataScript = $('#__NEXT_DATA__');

if (nextDataScript.length) {
    try {
        const jsonData = JSON.parse(nextDataScript.html());
        console.log("Root Keys:", Object.keys(jsonData));

        if (jsonData.props && jsonData.props.pageProps) {
            console.log("PageProps Keys:", Object.keys(jsonData.props.pageProps));

            // Look for potential product data locations
            const props = jsonData.props.pageProps;

            if (props.req) console.log("Req found (server data?)");
            if (props.dehydratedState) console.log("dehydratedState found (react-query?)");
            if (props.initialState) console.log("initialState found (redux?)");
            // creating a safe dump helper
            const safeDump = (obj, path = '') => {
                if (!obj) return;
                if (Array.isArray(obj)) {
                    console.log(`[${path}] is Array of length ${obj.length}`);
                    if (obj.length > 0 && typeof obj[0] === 'object') {
                        console.log(`   Sample item keys: ${Object.keys(obj[0]).join(', ')}`);
                    }
                } else if (typeof obj === 'object') {
                    console.log(`[${path}] keys: ${Object.keys(obj).join(', ')}`);
                }
            };

            if (props.dehydratedState) {
                // React Query often hides data here
                // console.log(JSON.stringify(props.dehydratedState, null, 2).substring(0, 500)); 
                if (props.dehydratedState.queries) {
                    props.dehydratedState.queries.forEach((q, i) => {
                        console.log(`Query ${i} Key:`, q.queryKey);
                        // check data
                        if (q.state && q.state.data) {
                            if (q.state.data.browse) {
                                console.log(">>> Found 'browse' data in Query!");
                                safeDump(q.state.data.browse, `query[${i}].state.data.browse`);
                                if (q.state.data.browse.results) {
                                    safeDump(q.state.data.browse.results, `query[${i}].state.data.browse.results`);
                                }
                            }
                        }
                    });
                }
            }

        }
    } catch (e) {
        console.error("Error parsing JSON:", e);
    }
} else {
    console.log("No __NEXT_DATA__ script found.");
}
