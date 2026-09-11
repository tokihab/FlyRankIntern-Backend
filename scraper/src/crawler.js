const cheerio = require('cheerio');
const { fetchHtml } = require('./fetcher');

const FIRST_CATALOGUE_PAGE = 'https://books.toscrape.com/catalogue/page-1.html';
const MAX_CATALOGUE_PAGES = 3;

async function discoverBooks() {
  const pages = [];
  const books = [];
  const seenProducts = new Set();
  let currentUrl = FIRST_CATALOGUE_PAGE;

  while (currentUrl && pages.length < MAX_CATALOGUE_PAGES) {
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
  }

  return { pages, books };
}

module.exports = {
  FIRST_CATALOGUE_PAGE,
  discoverBooks
};
