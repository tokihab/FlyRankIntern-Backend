const express = require('express');
const { serve } = require('inngest/express');
const { inngest } = require('../inngest/client');
const { 
  sayHello, 
  makeReport, 
  heartbeat 
} = require('../inngest/functions');

const router = express.Router();

router.use(
  serve({
    client: inngest,
    functions: [sayHello, makeReport, heartbeat]
  })
);

module.exports = router;