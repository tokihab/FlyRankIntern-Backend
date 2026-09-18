const fs = require('fs');
const path = require('path');
const { runScraper } = require('../services/scraper.service');
const { urlSchema } = require('../validators/scraper.validator');

let scraperRunPromise = null;

function readScraperOutput(filename, fallback) {
  const scraperOutputDir = path.join(__dirname, '..', '..', 'scraper', 'output');
  try {
    return JSON.parse(fs.readFileSync(path.join(scraperOutputDir, filename), 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function getScraperData(req, res) {
  const books = readScraperOutput('books.json', []);
  const quotes = readScraperOutput('quotes.json', []);
  const articles = readScraperOutput('articles.json', []);
  const report = readScraperOutput('run-report.json', null);
  
  // Return all available data
  res.json({
    books,
    quotes,
    articles,
    report
  });
}

async function triggerScraper(req, res) {
  if (scraperRunPromise) {
    return res.status(202).json({ status: 'running' });
  }

  const targetUrl = typeof req.body?.targetUrl === 'string' && req.body.targetUrl.trim()
    ? req.body.targetUrl.trim()
    : undefined;
  
  if (targetUrl) {
    try {
      const parsedUrl = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS targets are supported');
      }
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid targetUrl' });
    }
  }
  
  scraperRunPromise = runScraper(targetUrl);
  try {
    await scraperRunPromise;
    const report = readScraperOutput('run-report.json', null);
    return res.status(202).json({ status: 'completed', report });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Scraper run failed' });
  } finally {
    scraperRunPromise = null;
  }
}

module.exports = {
  getScraperData,
  triggerScraper
};
