const { Inngest } = require('inngest');

const inngest = new Inngest({
  id: 'report-api',
  baseUrl: process.env.INNGEST_BASE_URL || 'http://inngest:8288',
  isDev: true
});

module.exports = { inngest };