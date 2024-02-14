/* eslint-disable no-console */
const axios = require('axios');
require('dotenv-flow').config();

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;

// Get the first argument which should be a comma-separated list of article IDs we want to archive
if ((process.argv[2] || '').length === 0) {
    throw new Error('Please provide at least one article ID to archive');
}

// Parse the list of article IDs
const articleIds = process.argv[2].split(',');
const articles = [];

const performOperation = (id) => {
    // Construct the URL for the API request
    const apiURL = `https://${zendesk_subdomain}.zendesk.com/api/v2/help_center/articles/${id}`;

    axios({
        method: 'DELETE',
        url: apiURL,
        headers: {
            Authorization: `Basic ${Buffer.from(
                `${zendesk_email}/token:${zendesk_api_token}`
            ).toString('base64')}`,
        },
        data: {},
    })
        .then(function (response) {
            if (response.status === 204) {
                console.log(`[${id}] Article successfully archived.`)
            }
        })
        .catch(function (error) {
            if (error.response.status === 401 || error.response.status == 403) {
                console.log(
                    'Authentication failed. Please check your API credentials.'
                );
                return;
            } else if (error.response.status === 429) {
                // We have hit a rate limit. Read the "Retry-After" header and retry
                // the request later on
                const delay = response.headers['retry-after'];
                console.log(
                    `Hit a rate limit, will wait for ${delay} seconds and try again.`
                );
                setTimeout(() => {
                    console.log(`Retrying after waiting for ${delay} seconds`);
                    performOperation(articleIds);
                }, delay * 1000);
                return;
            } else {
                if (error.response.status === 404) {
                    console.error(`[Article ID: ${id}] There was an error archiving this article; it doesn't exist or has already been archived.`)
                }
            }
        });
};

// The Bulk Delete Endpoint accepts up to 100 ticket IDs at a time
// hence we will split the list of ticket IDs into buckets of 100 IDs each
// See https://developer.zendesk.com/rest_api/docs/support/tickets#bulk-delete-tickets
while (articleIds.length > 0) {
    articles.push(articleIds.splice(0, 1));
}

// Kick-off an API request for each bucket of ticket IDs. We will handle rate limiting
// in the request callback itself which will retry the request automatically whenever
// we run into a rate limit by using the `Retry-After` response header the API returns.
articles.forEach((article, i) => {
    const articleSingular = articles.length === 1
    console.log(`Archiving ${articles.length} ${articleSingular ? 'article' : 'articles'}...`)
    setTimeout(() => {
        performOperation(article.toString());
    }, (1 + i) * 1200);
});
