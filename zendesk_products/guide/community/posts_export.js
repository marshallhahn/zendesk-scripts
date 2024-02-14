const path = require('path')

const request = require('request');
const fs = require('fs');

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;
const community_topic = '';

const exportApiUrl = `https://${zendesk_subdomain}.zendesk.com/api/v2/community/topics/${community_topic}/posts?page[size]=100`;

var posts = [];

exportPosts(exportApiUrl);

function exportPosts(url) {
  dLog(`Sending request to ${url}`);
  request(
    {
      method: 'GET',
      url: url,
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${zendesk_email}/token:${zendesk_api_token}`).toString(
            'base64'
          ),
      },
      json: true,
    },
    (error, response, body) => {
      if (response.statusCode === 401) {
        dLog(`Authentication failed. Please check your API credentials.`);
        return;
      }

      // We have hit a rate limit. Read the "Retry-After" header and retry
      // the request later
      if (response.statusCode === 429) {
        const delay = response.headers['retry-after'];
        dLog(
          `Hit rate limit, will delay execution for another ${delay} seconds`
        );
        setTimeout(() => {
          dLog(`Retrying after waiting for ${delay} seconds`);
          exportPosts(url);
        }, delay * 1000);
        return;
      }

      if (body.posts.length > 0) {
        posts = posts.concat(body.posts);

        if (body.meta.has_more === true) {
          dLog(`Requesting next page from ${body.links.next}`);
          exportPosts(body.links.next);
        } else {
          savePosts();
        }
      } else {
        savePosts();
      }
    }
  );
}

function dLog(message) {
  const now = new Date();
  console.log(
    `[${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}]: ${message}`
  );
}

function savePosts() {
  // Before we save all the exported tickets we need to filter out pagination duplicates
  // See https://developer.zendesk.com/rest_api/docs/support/incremental_export#excluding-pagination-duplicates
  const postMap = new Map();
  posts.forEach((post) => postMap.set(`${post.id}`, post));
  const filteredPosts = Array.from(postMap);

  // We reached the end of the export, save all tickets to a file
  fs.writeFile(
    './posts_exported.json',
    JSON.stringify(filteredPosts),
    (err) => {
      if (err) {
        return dLog(err);
      }

      dLog('The file was saved!');
    }
  );
}
