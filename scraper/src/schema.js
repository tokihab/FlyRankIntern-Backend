const { z } = require('zod');

const rawBookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS'),
  price_text: z.string().min(1),
  availability_text: z.string().min(1),
  rating_text: z.string().min(1),
  description: z.string().nullable(),
  source_page: z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS'),
  fetched_at: z.string().datetime()
});

const normalizedBookSchema = rawBookSchema.extend({
  price_gbp: z.number().positive()
});

function normalizeBook(rawBook) {
  const price_gbp = Number(rawBook.price_text.replace('£', '').trim());
  return { ...rawBook, price_gbp };
}

module.exports = {
  rawBookSchema,
  normalizedBookSchema,
  normalizeBook
};
