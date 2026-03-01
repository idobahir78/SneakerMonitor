const REPO = 'idobahir78/SneakerMonitor';
const WORKFLOW_FILE = 'scrape.yml';

exports.handler = async function (event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Retrieve the securely stored GitHub token
    const token = process.env.GITHUB_PAT;
    if (!token) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Missing GITHUB_PAT environment variable in Netlify" })
        };
    }

    try {
        const payload = JSON.parse(event.body);
        const { search_term, sizes, search_id } = payload;

        if (!search_term || !search_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required parameters: search_term or search_id" })
            };
        }

        const inputs = {
            search_term: search_term,
            sizes: sizes || "*",
            search_id: search_id
        };

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'Authorization': `token ${token}`,
            'User-Agent': 'SneakerMonitor-Netlify-Proxy'
        };

        const response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ ref: 'main', inputs })
        });

        if (response.ok || response.status === 204) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "Workflow dispatched successfully" })
            };
        } else {
            const errText = await response.text();
            return {
                statusCode: response.status,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: `GitHub API Error: ${errText}` })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Internal Server Error", details: error.message })
        };
    }
};
