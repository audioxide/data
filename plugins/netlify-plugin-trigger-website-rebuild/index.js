const fetch = require('node-fetch');

module.exports = {
  onPostBuild() {
    if (process.env.BRANCH !== 'main') return Promise.resolve();
    return fetch(
      'https://api.netlify.com/build_hooks/' + process.env.WEBSITE_DEPLOY_HOOK,
      { method: 'POST' },
    ).then(r => {
      if (!r.ok) throw Error(`Error ${r.status}: ${r.statusText}`);
      return r.ok;
    });
  }
}