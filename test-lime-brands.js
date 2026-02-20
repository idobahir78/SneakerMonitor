(async () => {
    try {
        const brands = ['Adidas', 'Vans', 'New Balance', 'Jordan', 'נעלי'];

        for (const brand of brands) {
            const query = encodeURIComponent(brand);
            const url = `https://limeshoes.co.il/?wc-ajax=dgwt_wcas_ajax_search&s=${query}`;
            console.log(`\nFetching: ${brand}`);

            const res = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36'
                }
            });

            const data = await res.json();
            console.log(`Results for ${brand}: ${data.suggestions.length} suggestions`);
            if (data.suggestions.length > 0 && data.suggestions[0].type !== 'no-results') {
                console.log(JSON.stringify(data.suggestions[0], null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
})();
