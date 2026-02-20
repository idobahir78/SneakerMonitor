(async () => {
    try {
        const query = encodeURIComponent('Nike Dunk');
        const url = `https://limeshoes.co.il/?wc-ajax=dgwt_wcas_ajax_search&s=${query}`;
        console.log('Fetching:', url);

        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });

        const data = await res.json();
        console.log('Results:', data.suggestions.length, 'suggestions');
        console.log(JSON.stringify(data.suggestions.slice(0, 3), null, 2));
    } catch (e) {
        console.error(e);
    }
})();
