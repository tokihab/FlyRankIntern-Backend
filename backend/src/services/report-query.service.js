const db = require('../config/db');
const { getBooksData, getQuotesData } = require('./report-db.service');

// Get report data with SQL aggregation for books
function getReportData(type, filters = {}) {
  const dataService = type === 'books' ? getBooksData : getQuotesData;
  const rawData = dataService(filters);
  
  if (type === 'books') {
    return generateBooksReport(rawData, filters);
  } else if (type === 'quotes') {
    return generateQuotesReport(rawData, filters);
  }
  
  return { summary: {}, records: [] };
}

function generateBooksReport(books, filters) {
  // Calculate aggregates using SQLite queries
  const count = books.length;
  
  // Calculate average price
  let totalPrice = 0;
  let priceCount = 0;
  books.forEach(b => {
    if (b.price !== null && b.price !== undefined) {
      totalPrice += b.price;
      priceCount++;
    }
  });
  const avgPrice = priceCount > 0 ? (totalPrice / priceCount).toFixed(2) : 0;
  
  // Get top 5 most expensive
  const topExpensive = [...books]
    .filter(b => b.price !== null && b.price !== undefined)
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);
  
  // Rating breakdown
  const ratingBreakdown = {};
  books.forEach(b => {
    const rating = b.rating || 'Unknown';
    ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;
  });
  
  // Sort ratings
  const sortedRatings = Object.entries(ratingBreakdown)
    .sort(([a], [b]) => b.localeCompare(a));
  
  return {
    summary: {
      total_count: count,
      average_price: parseFloat(avgPrice),
      top_expensive: topExpensive.map(b => ({
        title: b.title,
        price: b.price,
        rating: b.rating,
        url: b.url
      })),
      rating_breakdown: sortedRatings.map(([rating, count]) => ({ rating, count })),
      filters_applied: filters
    },
    records: books.map(b => ({
      id: b.url,
      title: b.title,
      price: b.price,
      rating: b.rating,
      availability: b.availability,
      url: b.url
    }))
  };
}

function generateQuotesReport(quotes, filters) {
  const count = quotes.length;
  
  // Top authors
  const authorCounts = {};
  quotes.forEach(q => {
    const author = q.author || 'Unknown';
    authorCounts[author] = (authorCounts[author] || 0) + 1;
  });
  
  const topAuthors = Object.entries(authorCounts)
    .sort(([a, aCount], [b, bCount]) => bCount - aCount)
    .slice(0, 5)
    .map(([author, count]) => ({ author, count }));
  
  // Tag breakdown
  const tagCounts = {};
  quotes.forEach(q => {
    try {
      const tags = JSON.parse(q.tags || '[]');
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    } catch (e) {
      // Skip invalid tags
    }
  });
  
  const sortedTags = Object.entries(tagCounts)
    .sort(([a, aCount], [b, bCount]) => bCount - aCount);
  
  return {
    summary: {
      total_count: count,
      top_authors: topAuthors,
      tag_breakdown: sortedTags.map(([tag, count]) => ({ tag, count })),
      filters_applied: filters
    },
    records: quotes.map(q => ({
      id: q.url,
      text: q.text,
      author: q.author,
      tags: tryParseTags(q.tags),
      url: q.url
    }))
  };
}

function tryParseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    return JSON.parse(tags);
  } catch (e) {
    return [];
  }
}

// Get raw data for PDF table (without pagination)
function getDataForPdf(type, filters = {}) {
  const dataService = type === 'books' ? getBooksData : getQuotesData;
  return dataService(filters);
}

module.exports = {
  getReportData,
  getDataForPdf,
  generateBooksReport,
  generateQuotesReport
};
