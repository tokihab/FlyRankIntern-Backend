const cheerio = require('cheerio');
const { fetchHtml, getFetchStats } = require('../../scraper/src/fetcher');
const fs = require('fs/promises');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'scraper', 'output');

async function writeRunReport(report) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(`${OUTPUT_DIR}/run-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function writeJson(filename, value) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, filename), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function detectContentType(html, url) {
  const $ = cheerio.load(html);
  
  // Check for books.toscrape.com patterns
  if (url.includes('books.toscrape.com') || $('article.product_pod').length > 0) {
    return 'book';
  }
  
  // Check for quotes.toscrape.com patterns
  if (url.includes('quotes.toscrape.com') || $('.quote').length > 0) {
    return 'quote';
  }
  
  // Default to generic article
  return 'article';
}

function extractBook(html, url) {
  const $ = cheerio.load(html);
  const ratingClasses = $('.star-rating').attr('class') || '';
  const ratingText = ratingClasses.split(/\s+/).find((className) => className !== 'star-rating') || null;
  const description = $('#product_description ~ p').first().text().trim() || null;

  return {
    entity: 'book',
    title: $('h1').first().text().trim(),
    price_gbp: parseFloat($('.product_main p.price_color').first().text().trim().replace('\u00a3', '').trim()) || 0,
    rating_text: ratingText || 'No rating',
    availability_text: $('.product_main p.availability').first().text().trim(),
    url: url
  };
}

function extractQuote(html, url) {
  const $ = cheerio.load(html);
  const quotes = [];
  
  $('.quote').each((index, element) => {
    const text = $(element).find('.text').text().trim();
    const author = $(element).find('.author').text().trim();
    const tags = $(element).find('.tag').map((i, el) => $(el).text().trim()).get();
    
    if (text && author) {
      quotes.push({
        entity: 'quote',
        text,
        author,
        tags,
        url
      });
    }
  });
  
  // If no quotes found with .quote selector, try alternative selectors
  if (quotes.length === 0) {
    const text = $('body').text().trim();
    const author = $('small').first().text().trim() || 'Unknown';
    const tags = [];
    
    if (text) {
      quotes.push({
        entity: 'quote',
        text,
        author,
        tags,
        url
      });
    }
  }
  
  return quotes.length > 0 ? quotes : [{
    entity: 'quote',
    text: $('h1').first().text().trim() || 'No text',
    author: $('.author').first().text().trim() || 'Unknown',
    tags: [],
    url
  }];
}

function extractArticle(html, url) {
  const $ = cheerio.load(html);
  const metaDescription = $('meta[name="description"]').attr('content') || null;
  const headings = [];
  
  $('h1, h2, h3, h4, h5, h6').each((index, element) => {
    const tag = element.tagName.toLowerCase();
    const text = $(element).text().trim();
    if (text) {
      headings.push(`${tag}: ${text}`);
    }
  });

  return {
    entity: 'article',
    title: $('title').first().text().trim() || $('h1').first().text().trim() || 'Untitled',
    description: metaDescription,
    headings,
    url
  };
}

async function extractFromUrl(targetUrl) {
  const html = await fetchHtml(targetUrl);
  const contentType = detectContentType(html, targetUrl);
  
  switch (contentType) {
    case 'book':
      return [extractBook(html, targetUrl)];
    case 'quote':
      return extractQuote(html, targetUrl);
    default:
      return [extractArticle(html, targetUrl)];
  }
}

async function discoverBooks(startUrl) {
  const pages = [];
  const books = [];
  const seenProducts = new Set();
  let currentUrl = startUrl;
  const MAX_CATALOGUE_PAGES = 1; // Reduced from 3 to 1 for faster scraping

  while (currentUrl && pages.length < MAX_CATALOGUE_PAGES) {
    try {
      const html = await fetchHtml(currentUrl);
      const $ = cheerio.load(html);
      pages.push(currentUrl);

      $('article.product_pod h3 a').each((index, element) => {
        const productUrl = new URL($(element).attr('href'), currentUrl).href;
        if (!seenProducts.has(productUrl)) {
          seenProducts.add(productUrl);
          books.push({ product_url: productUrl, source_page: currentUrl });
        }
      });

      const nextHref = $('li.next a').attr('href');
      currentUrl = nextHref ? new URL(nextHref, currentUrl).href : null;
    } catch (error) {
      console.error(`Failed to fetch catalogue page ${currentUrl}:`, error.message);
      break;
    }
  }

  return { pages, books };
}

async function extractBooks(discoveredBooks) {
  const records = [];
  const failedPages = [];
  const MAX_CONCURRENT = 5; // Limit concurrent requests
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < discoveredBooks.length; i += MAX_CONCURRENT) {
    const batch = discoveredBooks.slice(i, i + MAX_CONCURRENT);
    const batchPromises = batch.map(async (book) => {
      try {
        const html = await fetchHtml(book.product_url);
        const extracted = extractBook(html, book.product_url);
        return extracted;
      } catch (error) {
        failedPages.push({ url: book.product_url, error: error.message });
        console.error(`FAILED: ${book.product_url} (${error.message})`);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    records.push(...batchResults.filter(r => r !== null));
    
    // Small delay between batches to be polite
    if (i + MAX_CONCURRENT < discoveredBooks.length) {
      await delay(100);
    }
  }

  return { records, failedPages };
}

async function normalizeAndStore(rawRecords) {
  const validRecords = [];
  const errors = [];
  const seenUrls = new Set();

  for (const rawRecord of rawRecords) {
    // Validate that the record has the expected structure
    if (!rawRecord || typeof rawRecord !== 'object' || !rawRecord.entity || !rawRecord.url) {
      errors.push({
        url: rawRecord?.url || 'unknown',
        reason: 'Invalid record structure: missing entity or url'
      });
      continue;
    }

    // Check for duplicate URLs
    if (seenUrls.has(rawRecord.url)) {
      continue;
    }

    seenUrls.add(rawRecord.url);
    validRecords.push(rawRecord);
  }

  // Write results based on content type - always write all types for dynamic UI
  if (rawRecords.length > 0 && rawRecords[0].entity === 'book') {
    await writeJson('books.json', validRecords);
    // Clear old data from other types
    await writeJson('quotes.json', []);
    await writeJson('articles.json', []);
  } else if (rawRecords.length > 0 && rawRecords[0].entity === 'quote') {
    await writeJson('quotes.json', validRecords);
    // Clear old data from other types
    await writeJson('books.json', []);
    await writeJson('articles.json', []);
  } else {
    await writeJson('articles.json', validRecords);
    // Clear old data from other types
    await writeJson('books.json', []);
    await writeJson('quotes.json', []);
  }
  
  await writeJson('errors.json', errors);

  return { validRecords, errors };
}

async function runScraper(targetUrl) {
  const startTime = new Date();
  const startedAt = Date.now();
  
  // If targetUrl is a books.toscrape.com catalogue page, use the book discovery flow
  if (targetUrl && (targetUrl.includes('books.toscrape.com') || targetUrl.includes('catalogue'))) {
    const { books } = await discoverBooks(targetUrl);
    const { records, failedPages } = await extractBooks(books);
    const { validRecords, errors } = await normalizeAndStore(records);

    const report = {
      start_time: startTime.toISOString(),
      duration_ms: Date.now() - startedAt,
      ...getFetchStats(),
      valid_records: validRecords.length,
      invalid_records: errors.length,
      failed_pages: failedPages.length
    };
    await writeRunReport(report);
    console.log(JSON.stringify(report, null, 2));
    return { validRecords, errors, report };
  } else {
    // For any other URL, use the universal extractor
    try {
      const records = await extractFromUrl(targetUrl || 'https://books.toscrape.com');
      const { validRecords, errors } = await normalizeAndStore(records);

      const report = {
        start_time: startTime.toISOString(),
        duration_ms: Date.now() - startedAt,
        ...getFetchStats(),
        valid_records: validRecords.length,
        invalid_records: errors.length,
        failed_pages: 0
      };
      await writeRunReport(report);
      console.log(JSON.stringify(report, null, 2));
      return { validRecords, errors, report };
    } catch (error) {
      const report = {
        start_time: startTime.toISOString(),
        duration_ms: Date.now() - startedAt,
        ...getFetchStats(),
        valid_records: 0,
        invalid_records: 1,
        failed_pages: 1,
        error: error.message
      };
      await writeRunReport(report);
      console.log(JSON.stringify(report, null, 2));
      throw error;
    }
  }
}

module.exports = {
  runScraper,
  extractFromUrl,
  discoverBooks,
  extractBooks,
  normalizeAndStore,
  detectContentType,
  extractBook,
  extractQuote,
  extractArticle
};
