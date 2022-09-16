/* eslint-disable no-console */
const request = require('request');

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;

// The first parameter for our script is the operation we want to perform.
// The script can either soft delete, permanently delete or restore the user IDs that
// are provided.
const operation = process.argv[2];
if (operation !== 'soft-delete') {
  throw new Error(
    `${operation} is not a valid operation. Must be soft-delete.`
  );
}

// Get the first argument which should be a comma-separated list of user IDs we want to delete
if ((process.argv[3] || '').length === 0) {
  throw new Error('Please provide at least one user ID to delete');
}

// Parse the list of user IDs
const userIds = process.argv[3].split(',');
const maxBucketSize = 100;
const buckets = [];

// For simplicity we map the operation to the actual API endpoint that we need to use
const operationToApiMapping = {
  'soft-delete': 'users/destroy_many.json',
};

const performOperation = (ids, op) => {
  // Construct the URL for the API request
  const apiURL = `https://${zendesk_subdomain}.zendesk.com/api/v2/${operationToApiMapping[op]}?ids=${ids}`;

  let httpMethod = null;
  if (operation === 'soft-delete') {
    httpMethod = 'DELETE';
  }

  request(
    {
      url: apiURL,
      method: httpMethod,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${zendesk_email}/token:${zendesk_api_token}`
        ).toString('base64')}`,
      },
      json: true,
    },
    (_, response, body) => {
      if (response.statusCode === 401) {
        console.log(
          'Authentication failed. Please check your API credentials.'
        );
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
          performOperation(userIds);
        }, delay * 1000);
        return;
      }

      console.log(body || 'Done');
    }
  );
};

// The Bulk Delete Endpoint accepts up to 100 user IDs at a time
// hence we will split the list of user IDs into buckets of 100 IDs each
// See https://developer.zendesk.com/rest_api/docs/support/users#bulk-deleting-users
while (userIds.length > 0) {
  buckets.push(userIds.splice(0, maxBucketSize));
}

// Kick-off an API request for each bucket of user IDs. We will handle rate limiting
// in the request callback itself which will retry the request automatically whenever
// we run into a rate limit by using the `Retry-After` response header the API returns.
buckets.forEach((bucket) => {
  performOperation(bucket.join(','), operation);
});
