const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.resolve(__dirname, '..', 'cache');
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/YOUR_USERNAME/flyrank-task-api)';
const REQUEST_DELAY_MS = 500;
let lastNetworkRequestAt = 0;
const stats = { pages_fetched: 0, cache_hits: 0 };

function cachePathFor(url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(CACHE_DIR, `${hash}.html`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPoliteInterval() {
  const elapsed = Date.now() - lastNetworkRequestAt;
  const waitMs = Math.max(0, REQUEST_DELAY_MS - elapsed);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function fetchHtml(url, attempt = 0) {
  const cachePath = cachePathFor(url);

  try {
    const html = await fs.readFile(cachePath, 'utf8');
    stats.cache_hits += 1;
    console.log(`CACHE HIT: ${url} (${Buffer.byteLength(html, 'utf8')} bytes)`);
    return html;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await waitForPoliteInterval();
  lastNetworkRequestAt = Date.now();
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    if (attempt === 0) {
      await sleep(1000);
      return fetchHtml(url, 1);
    }
    throw error;
  }

  if (response.status !== 200) {
    const requestError = new Error(`HTTP ${response.status} for ${url}`);
    requestError.status = response.status;
    if (response.status >= 500 && attempt === 0) {
      await sleep(1000);
      return fetchHtml(url, 1);
    }
    throw requestError;
  }

  const html = await response.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePath, html, 'utf8');
  stats.pages_fetched += 1;
  console.log(`FETCH: ${url} (${Buffer.byteLength(html, 'utf8')} bytes)`);
  return html;
}

function getFetchStats() {
  return { ...stats };
}

module.exports = {
  CACHE_DIR,
  USER_AGENT,
  fetchHtml,
  getFetchStats
};
