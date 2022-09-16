/* eslint-disable no-console */
const request = require('request');

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;
const query = '';

let results = [];
const searchUrl = `https://${zendesk_subdomain}.zendesk.com/api/v2/search.json?query=${query}`;

const processResults = (tickets) => {
  console.log(`Found ${tickets.length} tickets`);
  console.log(tickets.map((ticket) => ticket.id).join(','));
};

const searchTickets = (url) => {
  request(
    {
      url,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${zendesk_email}/token:${zendesk_api_token}`
        ).toString('base64')}`,
      },
      json: true,
    },
    (error, response, body) => {
      if (error) {
        console.log(`ERROR: ${error}`);
        return;
      }

      if (response.statusCode === 401) {
        console.log(
          'Authentication failed. Please check your API credentials.'
        );
        return;
      }

      // Even when using pagination, results are limited to 2,000 pages with 100 results each, so a total of 200,000
      // results. Starting Oct. 19th 2019, this will be limited to 1,000 results, or 10 pages with 100 results each
      // https://developer.zendesk.com/rest_api/docs/support/search#results-limit
      // Here we handle the error the API will return if we reach that limit
      if (response.statusCode === 422) {
        console.log('We reached the limit of total search results, exiting');
        processResults(results);
        return;
      }

      // We have hit a rate limit. Read the "Retry-After" header and retry
      // the request later on
      if (response.statusCode === 429) {
        const delay = response.headers['retry-after'];
        console.log(
          `Hit a rate limit, will wait for ${delay} seconds and try again.`
        );
        setTimeout(() => {
          console.log(`Retrying after waiting for ${delay} seconds`);
          searchTickets(url);
        }, delay * 1000);
        return;
      }

      results = results.concat(body.results);

      // If there are more results to be loaded we will load the next page
      // until we reach the end of the results

      if (body.next_page != null) {
        searchTickets(body.next_page);
        return;
      }

      // Finished loading all results
      processResults(results);
    }
  );
};

/**
 * Here we start the initial search request.
 *
 * We will paginate through the results until we reach the end of the result list
 * and then output the results to the console. You can customize what the script
 * should do with the final result list in the `processResults` function.
 */
searchTickets(searchUrl);
