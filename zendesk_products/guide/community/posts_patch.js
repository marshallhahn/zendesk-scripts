/* eslint-disable no-console */
const axios = require('axios');

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;
const community_topicId = '';

// Get the first argument which should be a comma-separated list of ticket IDs we want to delete
if ((process.argv[2] || '').length === 0) {
  throw new Error('Please provide at least one post ID to patch');
}

// Parse the list of ticket IDs
const postIds = process.argv[2].split(',');
const posts = [];

const performOperation = (id) => {
  // Construct the URL for the API request
  const apiURL = `https://${zendesk_subdomain}.zendesk.com/api/v2/community/posts/${id}.json`;

  axios({
    method: 'PATCH',
    url: apiURL,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${zendesk_email}/token:${zendesk_api_token}`
      ).toString('base64')}`,
    },
    data: {
      topic_id: community_topicId,
    },
  })
    .then(function (response) {
      console.log(
        `[${response.data.post.updated_at}] Post: ${response.data.post.id} - Topic: ${response.data.post.topic_id}`
      );
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
          performOperation(postIds);
        }, delay * 1000);
        return;
      } else {
        console.log(error.response.status);
        console.log(error.response.statusText);
      }
    });
};

// The Bulk Delete Endpoint accepts up to 100 ticket IDs at a time
// hence we will split the list of ticket IDs into buckets of 100 IDs each
// See https://developer.zendesk.com/rest_api/docs/support/tickets#bulk-delete-tickets
while (postIds.length > 0) {
  posts.push(postIds.splice(0, 1));
}

// Kick-off an API request for each bucket of ticket IDs. We will handle rate limiting
// in the request callback itself which will retry the request automatically whenever
// we run into a rate limit by using the `Retry-After` response header the API returns.
posts.forEach((post, i) => {
  setTimeout(() => {
    performOperation(post.toString());
  }, (1 + i) * 1200);
});
