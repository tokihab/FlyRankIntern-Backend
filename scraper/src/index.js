const { discoverBooks } = require('./crawler');
const { extractBooks } = require('./extractor');

discoverBooks()
	.then(async ({ books }) => {
		const records = await extractBooks(books);
		console.log(`detail_pages=${records.length}`);
		console.log(JSON.stringify(records[0], null, 2));
	})
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
