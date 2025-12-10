const serverless = require('serverless-http');
const app = require('./server');

// Wrap the Express App
module.exports.handler = serverless(app);
