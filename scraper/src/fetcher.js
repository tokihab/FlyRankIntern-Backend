const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.resolve(__dirname, '..', 'cache');
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/YOUR_USERNAME/flyrank-task-api)';
const REQUEST_DELAY_MS = 500;
let lastNetworkRequestAt = 0;

function cachePathFor(url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(CACHE_DIR, `${hash}.html`);
}

async function waitForPoliteInterval() {
  const elapsed = Date.now() - lastNetworkRequestAt;
  const waitMs = Math.max(0, REQUEST_DELAY_MS - elapsed);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function fetchHtml(url) {
  const cachePath = cachePathFor(url);

  try {
    const html = await fs.readFile(cachePath, 'utf8');
    console.log(`CACHE HIT: ${url} (${Buffer.byteLength(html, 'utf8')} bytes)`);
    return html;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await waitForPoliteInterval();
  lastNetworkRequestAt = Date.now();
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(5000)
  });

  if (response.status !== 200) {
    const requestError = new Error(`HTTP ${response.status} for ${url}`);
    requestError.status = response.status;
    throw requestError;
  }

  const html = await response.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePath, html, 'utf8');
  console.log(`FETCH: ${url} (${Buffer.byteLength(html, 'utf8')} bytes)`);
  return html;
}

module.exports = {
  CACHE_DIR,
  USER_AGENT,
  fetchHtml
};
