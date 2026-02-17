const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PARTIAL_FILE = process.argv[2];
const MAX_RETRIES = 5;

if (!PARTIAL_FILE) {
    console.error("Usage: node git_sync.js <partial_file>");
    process.exit(1);
}

function run(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        throw new Error(`Command failed: ${command}\nOutput: ${e.stdout}\nError: ${e.stderr}`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sync() {
    console.log(`🔄 [GitSync] Starting sync for ${PARTIAL_FILE}...`);

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            // 1. Reset loose changes to avoid conflicts (we only care about the partial file which is ignored or separate)
            // But wait, we need to modify data.json.
            // Reset hard to HEAD to clear any previous failed merge states
            run('git reset --hard HEAD');

            // 2. Pull Rebase
            run('git pull --rebase -X theirs origin main');

            // 3. Patch
            // We call the existing patch script
            const patchScript = path.join(__dirname, 'patch_results.js');
            run(`node "${patchScript}" "${PARTIAL_FILE}"`);

            // 4. Add & Commit
            const dataFile = 'frontend/public/data.json';
            run(`git add "${dataFile}"`);

            // Check if there are changes
            try {
                run('git diff --cached --quiet');
                console.log("ℹ️ [GitSync] No changes to commit.");
                return; // Nothing to do
            } catch (e) {
                // git diff returns 1 if there are changes, which causes run() to throw if we don't catch/handle.
                // Actually execSync throws on non-zero exit.
                // So if it throws, it means there ARE changes (exit 1). 
                // Wait, --quiet implies exit 1 if changed.
            }

            // If we are here, we might have changes. Let's try commit.
            try {
                run(`git commit -m "Partial update from ${PARTIAL_FILE} [${new Date().toISOString()}]"`);
            } catch (e) {
                console.log("ℹ️ [GitSync] Commit failed (maybe empty?): " + e.message);
                return;
            }

            // 5. Push
            run('git push origin main');
            console.log("✅ [GitSync] Successfully pushed updates.");
            return;

        } catch (err) {
            console.error(`⚠️ [GitSync] Attempt ${i + 1}/${MAX_RETRIES} failed: ${err.message}`);
            // Random sleep 2-5s to avoid thundering herd
            const waitTime = Math.floor(Math.random() * 3000) + 2000;
            await sleep(waitTime);
        }
    }

    console.error("❌ [GitSync] Failed to sync after max retries.");
}

sync();
