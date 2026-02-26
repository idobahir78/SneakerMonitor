const https = require('https');

const repo = 'idobahir78/SneakerMonitor';
const options = {
    hostname: 'api.github.com',
    path: `/repos/${repo}/actions/workflows/scrape.yml/runs?per_page=2`,
    headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json'
    }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const runs = JSON.parse(data).workflow_runs;
            if (runs.length > 0) {
                // Let's get the latest run
                const run = runs[0];
                console.log(`Latest Scrape Run ID: ${run.id}, Status: ${run.status}, Conclusion: ${run.conclusion}`);
                console.log(`Triggered by: ${run.event} (actor: ${run.actor.login})`);

                // Fetch jobs
                const jobOpts = { ...options, path: new URL(run.jobs_url).pathname };
                https.get(jobOpts, (jobRes) => {
                    let jobData = '';
                    jobRes.on('data', chunk => jobData += chunk);
                    jobRes.on('end', () => {
                        const jobs = JSON.parse(jobData).jobs;
                        if (jobs && jobs.length > 0) {
                            const mainJob = jobs[0]; // Scrape & Deploy
                            console.log(`Job Log URL: https://github.com/${repo}/actions/runs/${run.id}`);
                            mainJob.steps.forEach(s => {
                                console.log(`Step: ${s.name}, Status: ${s.status}, Conclusion: ${s.conclusion}`);
                            });
                        }
                    });
                });
            } else {
                console.log("No runs found.");
            }
        } else {
            console.log(`Error: ${res.statusCode} ${data}`);
        }
    });
}).on('error', err => console.error(err));
