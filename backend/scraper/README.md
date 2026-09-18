# FlyRank A9: The Polite Scraper

## Target Classification

**Target:** https://books.toscrape.com/

This is a public scraping sandbox designed for learning and testing web scrapers. The scope is limited to catalogue pages 1 through 3, yielding exactly 60 books.

The `robots.txt` check was performed before collection. Result: the endpoint returned `404 Not Found`, so no site-specific robots directives were published there for this sandbox. The scraper remains limited to the documented catalogue scope.

> I will not reuse this code on another site without checking its rules and terms first.

## Run It

From this directory:

```bash
npm install && npm start
```

The pipeline discovers catalogue pages 1 through 3, reads or downloads cached HTML, extracts 60 books, validates normalized records, and writes JSON files under `output/`.

## Politeness and Resilience

- Every live request sends the custom User-Agent `FlyRankInternship-A9/1.0 (+https://github.com/YOUR_USERNAME/flyrank-task-api)`.
- Live requests are paced with at least 500 ms between network calls. Cache reads do not wait.
- Every request uses `AbortSignal.timeout(5000)`.
- Downloaded HTML is cached under `cache/`; repeated development runs read from disk.
- A timeout or HTTP 5xx is retried once after one second. HTTP 403 and 404 responses are not retried.
- A failed detail page is recorded and cannot abort the rest of the run.
- The deliberate 404 failure probe is isolated from the 60-book queue so the resilience behavior remains observable without changing the final dataset.

## JSON Schema

Each normalized record in `output/books.json` contains:

```json
{
	"title": "string",
	"product_url": "https://...",
	"price_text": "£51.77",
	"price_gbp": 51.77,
	"availability_text": "In stock (22 available)",
	"rating_text": "Three",
	"description": "string or null",
	"source_page": "https://...",
	"fetched_at": "ISO 8601 UTC timestamp"
}
```

Zod validates all raw fields, requires HTTPS for `product_url` and `source_page`, and requires `price_gbp` to be a positive number. Invalid records are written to `output/errors.json`; canonical product URLs are unique.

## Run Evidence

The committed `output/run-report.json` from a complete run is:

```json
{
	"start_time": "2026-09-11T12:56:39.673Z",
	"duration_ms": 979,
	"pages_fetched": 0,
	"cache_hits": 63,
	"valid_records": 60,
	"invalid_records": 0,
	"failed_pages": 1
}
```

The 63 cache hits represent three catalogue pages and 60 detail pages. `failed_pages: 1` is the isolated deliberate 404 probe.

## Why No Browser Automation?

Browser automation was unnecessary because Books to Scrape serves the catalogue and product details as static server-rendered HTML. Native `fetch` retrieves the response and Cheerio parses the same HTML without the overhead of Puppeteer or Playwright.

## Outputs and Structure

```text
scraper/
├── cache/                 # Ignored downloaded HTML cache
├── output/
│   ├── books.json         # 60 normalized books
│   ├── errors.json        # Validation failures
│   └── run-report.json    # Run metrics and failure evidence
├── src/
│   ├── crawler.js         # Catalogue discovery
│   ├── extractor.js       # Product detail extraction
│   ├── fetcher.js         # Cache, pacing, timeout, and retry logic
│   ├── index.js           # Pipeline entry point
│   ├── pipeline.js        # Normalize, validate, and write outputs
│   └── schema.js          # Zod schemas
├── .gitignore
├── package.json
└── README.md
```

The scraper is intentionally scoped to this public learning sandbox. It must not be copied to another site without first checking that site's robots rules, terms, access expectations, and applicable laws.
