const fs = require('fs/promises');
const path = require('path');
const { normalizedBookSchema, normalizeBook } = require('./schema');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

async function writeJson(filename, value) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, filename), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function normalizeAndStore(rawRecords) {
  const validRecords = [];
  const errors = [];
  const seenUrls = new Set();

  for (const rawRecord of rawRecords) {
    const normalized = normalizeBook(rawRecord);
    const parsed = normalizedBookSchema.safeParse(normalized);

    if (!parsed.success) {
      errors.push({
        product_url: rawRecord.product_url,
        reason: parsed.error.issues.map((issue) => issue.message).join('; ')
      });
      continue;
    }

    if (seenUrls.has(parsed.data.product_url)) {
      continue;
    }

    seenUrls.add(parsed.data.product_url);
    validRecords.push(parsed.data);
  }

  await writeJson('books.json', validRecords);
  await writeJson('errors.json', errors);

  return { validRecords, errors };
}

module.exports = {
  OUTPUT_DIR,
  normalizeAndStore
};
