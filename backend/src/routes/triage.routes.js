const express = require('express');
const router = express.Router();
const { triage, getQuarantine } = require('../controllers/triage.controller');

router.post('/', triage);
router.get('/quarantine', getQuarantine);

module.exports = router;
