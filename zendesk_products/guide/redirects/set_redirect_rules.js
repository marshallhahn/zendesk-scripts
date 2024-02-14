/* eslint-disable no-console */
const axios = require('axios');
const YAML = require('yaml')
const fs = require('fs');

require('dotenv-flow').config();

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;
  
const file = fs.readFileSync('zendesk_products/guide/redirects/redirects.yml', 'utf8')
const redirects = YAML.parse(file)

const performOperation = (entry) => {
    // Construct the URL for the API request
    const apiURL = `https://${zendesk_subdomain}.zendesk.com/api/v2/guide/redirect_rules`;

    const {redirect_from, redirect_status, redirect_to} = entry 
    const body = {
        redirect_rule: {
            redirect_from,
            redirect_status,
            redirect_to
        }
    }   

  axios({
    method: 'POST',
    url: apiURL,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${zendesk_email}/token:${zendesk_api_token}`
      ).toString('base64')}`,
    },
    data: {
        ...body
    },
  })
    .then(function (response) {
      if(response.status === 204) {
        console.log(`[${redirect_status}] ${redirect_from} -> ${redirect_to}`)
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
          performOperation(entry);
        }, delay * 1000);
        return;
      } else {
        console.error(`[${id}] There was an error setting the redirect rule. Reason: ${error.response.status} - ${error.response.statusText}`)
      }
    });
};

// Kick-off an API request for each bucket of redirects. We will handle rate limiting
// in the request callback itself which will retry the request automatically whenever
// we run into a rate limit by using the `Retry-After` response header the API returns.
if (redirects.length > 0) {
  const redirectSingular = redirects.length === 1
  redirects.forEach((entry, i) => {
      console.log(`Setting ${redirects.length} ${redirectSingular ? 'redirect' : 'redirects'}...`)
      setTimeout(() => {
          performOperation(entry);
      }, (1 + i) * 1200);
  });
} else {
  console.error(`There are ${redirects.length} redirects. Please add at least one redirect in the redirect configuration file.`)
}