const fs = require('fs');
const path = require('path');
const FlexSearch = require('flexsearch');
const read = (filename) => fs.readFileSync(path.resolve(__dirname, filename), { encoding: 'utf8' });

const netlifyDomainSuffix = "competent-ardinghelli-0dde0e.netlify.app";
const domains = [
  "https://alpha.audioxide.com",
  "https://beta.audioxide.com",
  "https://audioxide.com",
];

const index = new FlexSearch(JSON.parse(read('./searchOptions.json')));
index.import(read('./searchIndex.json'));

const taxonomies = JSON.parse(read('./taxonomies.json'));

const LIMIT = 10;
const limitOpt = { limit: LIMIT };

// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
exports.handler = async (event, context) => {
  const { headers: { origin } } = event;
  if (!domains.includes(origin)
  && (typeof origin !== 'string' || !origin.endsWith(netlifyDomainSuffix))
  && process.env.ALLOW_LOCALHOST !== "true") {
    return {
      statusCode: 401,
      body: "{}",
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://audioxide.com" },
    };
  }
  try {
    const term = event.queryStringParameters.term.toLowerCase();
    const results = new Set();
    index.search(term, { field: ['title', 'tagStr'], ...limitOpt }).forEach(result => results.add(result));
    if (results.length < LIMIT) {
      index.search(term, limitOpt).forEach(result => results.add(result));
    }
    const response = {};
    const posts = Array.from(results).map(({ route, title }) => ({ route, title }));
    if (posts.length > 0) {
      response.posts = posts;
    }
    Object.entries(taxonomies).forEach(([taxonomy, values]) => {
      const matches = values.filter(item => item.title.indexOf(term) > -1);
      if (matches.length > 0) {
        response[taxonomy] = matches;
      }
    });
    // const subject = event.queryStringParameters.name || 'World'

    return {
      statusCode: 200,
      body: JSON.stringify(response),
        /* .slice(0, 10)
        .map(route => lookup[route])
        .sort((a, b) => {
          const matchA = a.metadata.title.toLowerCase().indexOf(term) > -1;
          const matchB = b.metadata.title.toLowerCase().indexOf(term) > -1;
          if (matchA === matchB) return 0;
          return ((matchB > matchA) * 2) -1;
        }) ),*/
      // // more keys you can return:
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin },
      // isBase64Encoded: true,
    }
  } catch (err) {
    return { statusCode: 500, body: err.toString() }
  }
}

// console.log(JSON.stringify(index.search("bjork").map(route => lookup[route])));
