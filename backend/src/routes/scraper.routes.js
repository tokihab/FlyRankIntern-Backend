const express = require('express');
const router = express.Router();
const { getScraperData, triggerScraper } = require('../controllers/scraper.controller');

router.get('/data', getScraperData);
router.post('/trigger', triggerScraper);
router.post('/', triggerScraper);

module.exports = router;