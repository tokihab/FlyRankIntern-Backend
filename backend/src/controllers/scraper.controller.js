const fs = require('fs');
const path = require('path');
const { runScraper } = require('../services/scraper.service');
const { urlSchema } = require('../validators/scraper.validator');
const { syncScrapedDataToDb } = require('../services/report-db.service');
const db = require('../config/db');

let scraperRunPromise = null;

function readScraperOutput(filename, fallback) {
  const scraperOutputDir = path.join(__dirname, '..', '..', 'scraper', 'output');
  try {
    const fullPath = path.join(scraperOutputDir, filename);
    if (!fs.existsSync(fullPath)) return fallback;
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

// Auto-sync existing scraped JSON into SQLite on module load if tables are currently empty
try {
  const booksCount = db.prepare('SELECT count(*) as c FROM books').get()?.c || 0;
  const quotesCount = db.prepare('SELECT count(*) as c FROM quotes').get()?.c || 0;

  if (booksCount === 0) {
    const books = readScraperOutput('books.json', []);
    if (books.length > 0) syncScrapedDataToDb('books', books);
  }
  if (quotesCount === 0) {
    const quotes = readScraperOutput('quotes.json', []);
    if (quotes.length > 0) syncScrapedDataToDb('quotes', quotes);
  }
} catch (e) {
  console.error('Initial DB sync check error:', e.message);
}

function getScraperData(req, res) {
  const books = readScraperOutput('books.json', []);
  const quotes = readScraperOutput('quotes.json', []);
  const articles = readScraperOutput('articles.json', []);
  const report = readScraperOutput('run-report.json', null);
  
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

  // Accept targetUrl or url from request body
  const rawUrl = req.body?.targetUrl || req.body?.url;
  const targetUrl = typeof rawUrl === 'string' && rawUrl.trim()
    ? rawUrl.trim()
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

    // Synchronize latest output files directly to SQLite
    const books = readScraperOutput('books.json', []);
    const quotes = readScraperOutput('quotes.json', []);
    if (books.length > 0) syncScrapedDataToDb('books', books);
    if (quotes.length > 0) syncScrapedDataToDb('quotes', quotes);

    const report = readScraperOutput('run-report.json', null);
    return res.status(200).json({ status: 'completed', report });
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