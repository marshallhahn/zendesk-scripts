const request = require("request");
const fs = require("fs");

const zendesk_subdomain = process.env.ZENDESK_SUBDOMAIN;
const zendesk_email = process.env.ZENDESK_EMAIL;
const zendesk_api_token = process.env.ZENDESK_API_TOKEN;

/**
 * Get the arguments that have been passed to our script
 */
const arguments = process.argv.slice(2);

if (arguments.length !== 3) {
  console.log("Usage: node main.js <start timestamp> <tag> <organization ID>");
  return;
}

const start_time = arguments[0];
const search_tag_name = arguments[1];
const search_organization_id = arguments[2];

const exportApiUrl = `https://${zendesk_subdomain}.zendesk.com/api/v2/incremental/tickets.json?start_time=${start_time}`;

var tickets = [];

exportTickets(exportApiUrl);

function exportTickets(url) {
  dLog(`Sending request to ${url}`);
  request(
    {
      url: url,
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${zendesk_email}/token:${zendesk_api_token}`).toString(
            "base64"
          )
      },
      json: true
    },
    (error, response, body) => {
      if (response.statusCode === 401) {
        dLog(`Authentication failed. Please check your API credentials.`);
        return;
      }

      // We have hit a rate limit. Read the "Retry-After" header and retry
      // the request later
      if (response.statusCode === 429) {
        const delay = response.headers["retry-after"];
        dLog(
          `Hit rate limit, will delay execution for another ${delay} seconds`
        );
        setTimeout(() => {
          dLog(`Retrying after waiting for ${delay} seconds`);
          exportTickets(url);
        }, delay * 1000);
        return;
      }

      const ticketCount = body.count;
      if (ticketCount > 0) {
        // We merge the current `tickets` array with the results
        // from the latest API call and also filter out all tickets
        // that do not contain the tag we're looking for
        tickets = tickets.concat(
          body.tickets
            .filter(ticket => ticket.organization_id == search_organization_id)
            .filter(ticket => ticket.tags.indexOf(search_tag_name) > -1)
        );

        // The incremental export endpoint ALWAYS returns a URL for the next page,
        // even if there is nothing to be found on the next page. Hence, we check
        // for `count` being less than 1000 to decide whether or not we need to
        // load the next page as per the Zendesk API documentation:
        // https://developer.zendesk.com/rest_api/docs/support/incremental_export#pagination

        if (ticketCount >= 1000) {
          dLog(`Requesting next page from ${body.next_page}`);
          exportTickets(body.next_page);
        } else {
          saveTickets();
        }
      } else {
        saveTickets();
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

function saveTickets() {
  // Before we save all the exported tickets we need to filter out pagination duplicates
  // See https://developer.zendesk.com/rest_api/docs/support/incremental_export#excluding-pagination-duplicates
  const ticketMap = new Map();
  tickets.forEach(ticket =>
    ticketMap.set(`${ticket.id}${ticket.updated_at}`, ticket)
  );
  const filteredTickets = Array.from(ticketMap);

  // We reached the end of the export, save all tickets to a file
  fs.writeFile(
    "./tickets_exported.json",
    JSON.stringify(filteredTickets),
    err => {
      if (err) {
        return dLog(err);
      }

      dLog("The file was saved!");
    }
  );
}
