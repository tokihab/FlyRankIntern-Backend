const cheerio = require('cheerio');
const { fetchHtml } = require('./fetcher');

function extractRawRecord(html, productUrl, sourcePage, fetchedAt) {
  const $ = cheerio.load(html);
  const ratingClasses = $('.star-rating').attr('class') || '';
  const ratingText = ratingClasses.split(/\s+/).find((className) => className !== 'star-rating') || null;
  const description = $('#product_description ~ p').first().text().trim() || null;

  return {
    title: $('h1').first().text().trim(),
    product_url: new URL(productUrl).href,
    price_text: $('.product_main p.price_color').first().text().trim(),
    availability_text: $('.product_main p.availability').first().text().trim(),
    rating_text: ratingText,
    description,
    source_page: new URL(sourcePage).href,
    fetched_at: fetchedAt
  };
}

async function extractBooks(discoveredBooks) {
  const records = [];

  for (const book of discoveredBooks) {
    const fetchedAt = new Date().toISOString();
    const html = await fetchHtml(book.product_url);
    records.push(extractRawRecord(html, book.product_url, book.source_page, fetchedAt));
  }

  return records;
}

module.exports = {
  extractBooks,
  extractRawRecord
};
