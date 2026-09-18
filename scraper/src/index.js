const { discoverBooks } = require('./crawler');
const { extractBooks } = require('./extractor');
const { normalizeAndStore } = require('./pipeline');
const { fetchHtml, getFetchStats } = require('./fetcher');
const { OUTPUT_DIR } = require('./pipeline');
const fs = require('fs/promises');

const FAILURE_PROBE_URL = 'https://books.toscrape.com/catalogue/deliberate-fail-book-99999/index.html';

async function writeRunReport(report) {
	await fs.mkdir(OUTPUT_DIR, { recursive: true });
	await fs.writeFile(`${OUTPUT_DIR}/run-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function run() {
	const startTime = new Date();
	const startedAt = Date.now();
	const { books } = await discoverBooks();
	const { records, failedPages } = await extractBooks(books);
	const { validRecords, errors } = await normalizeAndStore(records);

	let probeFailure = false;
	try {
		await fetchHtml(FAILURE_PROBE_URL);
	} catch (error) {
		probeFailure = true;
		console.log(`Failure probe survived: ${error.message}`);
	}

	const report = {
		start_time: startTime.toISOString(),
		duration_ms: Date.now() - startedAt,
		...getFetchStats(),
		valid_records: validRecords.length,
		invalid_records: errors.length,
		failed_pages: failedPages.length + (probeFailure ? 1 : 0)
	};
	await writeRunReport(report);
	console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
	run().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}

module.exports = { run };
