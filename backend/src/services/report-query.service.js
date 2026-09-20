const db = require('../config/db');
const { getBooksData, getQuotesData, getGenericData } = require('./report-db.service');

function tryParseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return String(tags).split(',').map(t => t.trim()).filter(Boolean);
  }
}

// Get report data with SQL aggregation
function getReportData(type, filters = {}) {
  if (type === 'books') {
    const rawData = getBooksData(filters);
    return generateBooksReport(rawData, filters);
  } else if (type === 'quotes') {
    const rawData = getQuotesData(filters);
    return generateQuotesReport(rawData, filters);
  } else {
    const rawData = getGenericData(type, filters);
    return generateGenericReport(rawData, filters, type);
  }
}

function getDataForPdf(type, filters = {}) {
  if (type === 'books') {
    return getBooksData(filters);
  } else if (type === 'quotes') {
    return getQuotesData(filters);
  } else {
    return getGenericData(type, filters);
  }
}

function generateBooksReport(books, filters) {
  const count = books.length;

  let totalPrice = 0;
  let priceCount = 0;
  books.forEach(b => {
    const price = typeof b.price === 'number' ? b.price : parseFloat(b.price || 0);
    if (!isNaN(price) && price > 0) {
      totalPrice += price;
      priceCount++;
    }
  });

  const avgPrice = priceCount > 0 ? (totalPrice / priceCount).toFixed(2) : 0;

  const topExpensive = [...books]
    .filter(b => b.price !== null && b.price !== undefined)
    .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
    .slice(0, 5);

  const ratingBreakdown = {};
  books.forEach(b => {
    const ratingLabel = b.rating ? `${b.rating} Star${b.rating > 1 ? 's' : ''}` : 'Unknown';
    ratingBreakdown[ratingLabel] = (ratingBreakdown[ratingLabel] || 0) + 1;
  });

  const sortedRatings = Object.entries(ratingBreakdown)
    .sort(([a], [b]) => b.localeCompare(a));

  return {
    summary: {
      total_count: count,
      average_price: parseFloat(avgPrice),
      top_expensive: topExpensive.map(b => ({
        title: b.title,
        price: Number(b.price) || 0,
        rating: b.rating ? `${b.rating} Stars` : 'N/A',
        url: b.url
      })),
      rating_breakdown: sortedRatings.map(([rating, c]) => ({ rating, count: c })),
      filters_applied: filters
    },
    records: books.map(b => ({
      title: b.title,
      price: Number(b.price) || 0,
      rating: b.rating ? `${b.rating} Stars` : 'N/A',
      availability: b.availability || 'In stock',
      url: b.url
    }))
  };
}

function generateQuotesReport(quotes, filters) {
  const count = quotes.length;

  const authorCounts = {};
  quotes.forEach(q => {
    const author = q.author || 'Unknown';
    authorCounts[author] = (authorCounts[author] || 0) + 1;
  });

  const topAuthors = Object.entries(authorCounts)
    .sort(([a, aCount], [b, bCount]) => bCount - aCount)
    .slice(0, 5)
    .map(([author, c]) => ({ author, count: c }));

  const tagCounts = {};
  quotes.forEach(q => {
    const tags = tryParseTags(q.tags);
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts)
    .sort(([a, aCount], [b, bCount]) => bCount - aCount);

  return {
    summary: {
      total_count: count,
      top_authors: topAuthors,
      tag_breakdown: sortedTags.map(([tag, c]) => ({ tag, count: c })),
      filters_applied: filters
    },
    records: quotes.map(q => ({
      id: q.id || q.url,
      text: q.text,
      author: q.author,
      tags: tryParseTags(q.tags),
      url: q.url
    }))
  };
}

function generateGenericReport(records, filters, type) {
  return {
    summary: {
      total_count: records.length,
      filters_applied: filters
    },
    records
  };
}

module.exports = {
  getReportData,
  getDataForPdf,
  generateBooksReport,
  generateQuotesReport,
  generateGenericReport
};