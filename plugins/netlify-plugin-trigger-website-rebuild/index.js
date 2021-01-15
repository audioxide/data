const https = require('https');

module.exports = {
  onPostBuild() {
    if (process.env.BRANCH !== 'website-trigger') return;
    return https.request({
      hostname: 'https://api.netlify.com',
      port: 443,
      path: '/build_hooks/' + process.env.WEBSITE_DEPLOY_HOOK,
      method: 'POST'
    }).end();
  }
}