const { fetchHtml } = require('./fetcher');

const firstCataloguePage = 'https://books.toscrape.com/catalogue/page-1.html';

fetchHtml(firstCataloguePage)
	.then(() => console.log('Stage 1 fetch check passed.'))
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
