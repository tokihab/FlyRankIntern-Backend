const db = require('../config/db');
const { getBooksData, getQuotesData, getGenericData } = require('./report-db.service');

// Get report data with SQL aggregation for any type
function getReportData(type, filters = {}) {
  // Try to get data based on type
  let rawData = [];
  
  if (type === 'books') {
    rawData = getBooksData(filters);
    return generateBooksReport(rawData, filters);
  } else if (type === 'quotes') {
    rawData = getQuotesData(filters);
    return generateQuotesReport(rawData, filters);
  } else {
    // For generic types, get all data from the table
    rawData = getGenericData(type, filters);
    return generateGenericReport(rawData, filters, type);
  }
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
  if (type === 'books') {
    return getBooksData(filters);
  } else if (type === 'quotes') {
    return getQuotesData(filters);
  } else {
    return getGenericData(type, filters);
  }
}

// Generic report generator for any entity type
function generateGenericReport(records, filters, type) {
  const count = records.length;
  
  // Try to identify key fields dynamically
  const keyFields = {};
  if (records.length > 0) {
    const firstRecord = records[0];
    Object.keys(firstRecord).forEach(key => {
      if (key !== 'id' && key !== 'url' && key !== 'entity') {
        keyFields[key] = typeof firstRecord[key];
      }
    });
  }
  
  // Build summary based on available fields
  const summary: Record<string, unknown> = {
    total_count: count,
    filters_applied: filters
  };
  
  // Add numeric field aggregates
  const numericFields = Object.entries(keyFields)
    .filter(([_, type]) => type === 'number')
    .map(([field]) => field);
  
  if (numericFields.length > 0) {
    numericFields.forEach(field => {
      const values = records.map(r => r[field]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        summary[`avg_${field}`] = Number(avg.toFixed(2));
        
        // Get top 5 by this field
        const sorted = [...records]
          .filter(r => r[field] !== null && r[field] !== undefined)
          .sort((a, b) => b[field] - a[field])
          .slice(0, 5);
        summary[`top_5_by_${field}`] = sorted;
      }
    });
  }
  
  // Add string field counts
  const stringFields = Object.entries(keyFields)
    .filter(([_, type]) => type === 'string')
    .map(([field]) => field);
  
  stringFields.forEach(field => {
    const counts = {};
    records.forEach(r => {
      const value = r[field] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5);
    summary[`${field}_breakdown`] = sorted.map(([value, count]) => ({ [field]: value, count }));
  });
  
  return {
    summary,
    records: records.map(r => {
      const result: Record<string, unknown> = { id: r.url || r.id };
      Object.keys(r).filter(k => !['entity', 'url'].includes(k)).forEach(key => {
        result[key] = r[key];
      });
      return result;
    })
  };
}

module.exports = {
  getReportData,
  getDataForPdf,
  generateBooksReport,
  generateQuotesReport,
  generateGenericReport
};
