const fs = require('fs');
const path = require('path');
const FlexSearch = require('flexsearch');
const read = (filename) => fs.readFileSync(path.resolve(__dirname, filename), { encoding: 'utf8' });

const index = new FlexSearch(JSON.parse(read('./searchOptions.json')));
index.import(read('./searchIndex.json'));

const LIMIT = 10;
const limitOpt = { limit: LIMIT };

// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
exports.handler = async (event, context) => {
  try {
    const term = event.queryStringParameters.term.toLowerCase();
    const results = [];
    results.push(...index.search(term, { field: ['title', 'tagStr'], ...limitOpt }));
    if (results.length < LIMIT) {
      results.push(...index.search(term, limitOpt));
    }
    // const subject = event.queryStringParameters.name || 'World'

    return {
      statusCode: 200,
      body: JSON.stringify(results.map(({ route, title }) => ({ route, title })))
        /* .slice(0, 10)
        .map(route => lookup[route])
        .sort((a, b) => {
          const matchA = a.metadata.title.toLowerCase().indexOf(term) > -1;
          const matchB = b.metadata.title.toLowerCase().indexOf(term) > -1;
          if (matchA === matchB) return 0;
          return ((matchB > matchA) * 2) -1;
        }) ),*/
      // // more keys you can return:
      // headers: { "headerName": "headerValue", ... },
      // isBase64Encoded: true,
    }
  } catch (err) {
    return { statusCode: 500, body: err.toString() }
  }
}

// console.log(JSON.stringify(index.search("bjork").map(route => lookup[route])));
