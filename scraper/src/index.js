const { discoverBooks } = require('./crawler');

discoverBooks()
	.then(({ pages, books }) => {
		console.log(`catalogue_pages=${pages.length}, discovered=${books.length}, unique_urls=${new Set(books.map((book) => book.product_url)).size}`);
	})
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
