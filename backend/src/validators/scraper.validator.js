const { z } = require('zod');

// Universal URL validator that allows both http and https
const urlSchema = z.string().url();

// Book schema for books.toscrape.com
const bookSchema = z.object({
  entity: z.literal('book'),
  title: z.string().min(1),
  price_gbp: z.number().positive(),
  rating_text: z.string().min(1),
  availability_text: z.string().min(1),
  url: z.string().url()
});

// Quote schema for quotes.toscrape.com
const quoteSchema = z.object({
  entity: z.literal('quote'),
  text: z.string().min(1),
  author: z.string().min(1),
  tags: z.array(z.string().min(1)),
  url: z.string().url()
});

// Generic article schema for any other URL
const articleSchema = z.object({
  entity: z.literal('article'),
  title: z.string().min(1),
  description: z.string().nullable(),
  headings: z.array(z.string()),
  url: z.string().url()
});

// Union type for all possible scraped entities
const scrapedEntitySchema = z.discriminatedUnion('entity', [
  bookSchema,
  quoteSchema,
  articleSchema
]);

module.exports = {
  urlSchema,
  bookSchema,
  quoteSchema,
  articleSchema,
  scrapedEntitySchema
};
