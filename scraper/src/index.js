const { discoverBooks } = require('./crawler');
const { extractBooks } = require('./extractor');
const { normalizeAndStore } = require('./pipeline');

discoverBooks()
	.then(async ({ books }) => {
		const records = await extractBooks(books);
		const { validRecords, errors } = await normalizeAndStore(records);
		console.log(`valid_records=${validRecords.length}, invalid_records=${errors.length}`);
	})
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
