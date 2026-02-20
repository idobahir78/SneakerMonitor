const fs = require('fs');
const html = fs.readFileSync('f54-dump.html', 'utf8');

const matches = html.match(/algolia|graphql|api_key|token/gi);
console.log(`Found ${matches ? matches.length : 0} API indicator strings.`);

if (matches) {
    const algoliaUrls = html.match(/https:\/\/[^"']*(algolia)[^"']*/g);
    if (algoliaUrls) console.log('Algolia URLs:', algoliaUrls);

    // Look for any exposed graphql endpoint
    const gqlUrls = html.match(/https:\/\/[^"']*(graphql)[^"']*/g);
    if (gqlUrls) console.log('GraphQL URLs:', gqlUrls);
}
