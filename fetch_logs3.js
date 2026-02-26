const https = require('https');
const fs = require('fs');

const repo = 'idobahir78/SneakerMonitor';
const jobId = '9456728362'; // We need the job ID, let me fetch it first

const options = {
    hostname: 'api.github.com',
    path: `/repos/${repo}/actions/workflows/scrape.yml/runs?per_page=1`,
    headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json'
    }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const run = JSON.parse(data).workflow_runs[0];

        // Fetch jobs for the run
        const jobOpts = { ...options, path: new URL(run.jobs_url).pathname };
        https.get(jobOpts, (jobRes) => {
            let jobData = '';
            jobRes.on('data', chunk => jobData += chunk);
            jobRes.on('end', () => {
                const job = JSON.parse(jobData).jobs[0];
                console.log(`Job ID: ${job.id}`);

                // Fetch logs
                const logOpts = { ...options, path: `/repos/${repo}/actions/jobs/${job.id}/logs` };

                // Note: logs redirect to a signed URL, so we need to handle 302
                const req = https.get(logOpts, (logRes) => {
                    if (logRes.statusCode === 302 || logRes.statusCode === 301) {
                        https.get(logRes.headers.location, (finalRes) => {
                            let logContent = '';
                            finalRes.on('data', c => logContent += c);
                            finalRes.on('end', () => {
                                fs.writeFileSync('action_log.txt', logContent);
                                console.log('Saved log to action_log.txt');

                                // Print some of it to find out what it searched for
                                const lines = logContent.split('\n');
                                const debugLines = lines.filter(l => l.includes('DEBUG: SEARCH_INPUT') || l.includes('🔎 Running'));
                                console.log("Key log lines:");
                                debugLines.forEach(l => console.log(l.substring(0, 150)));

                                const countLines = lines.filter(l => l.includes('Scanned') && l.includes('tasks. Found'));
                                console.log(countLines.join('\n'));
                            });
                        });
                    } else if (logRes.statusCode === 200) {
                        let logContent = '';
                        logRes.on('data', c => logContent += c);
                        logRes.on('end', () => {
                            fs.writeFileSync('action_log.txt', logContent);
                            console.log('Saved log to action_log.txt');
                        });
                    } else {
                        console.log(`Failed to fetch logs: ${logRes.statusCode}`);
                    }
                });
            });
        });
    });
});
