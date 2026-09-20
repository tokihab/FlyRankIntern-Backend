const path = require('path');
const db = require('../config/db');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const RATING_MAP = {
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5
};

function parseRating(ratingVal) {
  if (ratingVal === null || ratingVal === undefined) return 0;
  if (typeof ratingVal === 'number') return ratingVal;
  const normalized = String(ratingVal).toLowerCase().trim();
  return RATING_MAP[normalized] || parseInt(normalized, 10) || 0;
}

// Sync scraped data from JSON files to SQLite database
function syncScrapedDataToDb(type, data) {
  const tableName = type === 'books' ? 'books' : type === 'quotes' ? 'quotes' : null;
  
  if (!tableName || !Array.isArray(data) || data.length === 0) {
    console.log(`No data to sync for type: ${type}`);
    return 0;
  }

  try {
    const deleteStmt = db.prepare(`DELETE FROM ${tableName}`);
    deleteStmt.run();

    let insertedCount = 0;

    if (tableName === 'books') {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO books (id, title, price, rating, availability, url)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const b of data) {
        // Filter out non-book records like navigation/category pages
        if (!b.title || b.title === 'All products' && b.price_gbp === 0) continue;

        const id = b.url || uuidv4();
        const title = b.title || 'Untitled';
        const price = typeof b.price === 'number' 
          ? b.price 
          : (typeof b.price_gbp === 'number' ? b.price_gbp : parseFloat(b.price || b.price_gbp || 0));
        const rating = parseRating(b.rating || b.rating_text);
        const availability = b.availability || b.availability_text || 'In stock';
        const url = b.url || '';

        try {
          insertStmt.run(id, title, price, rating, availability, url);
          insertedCount++;
        } catch (err) {
          console.error('Failed to insert book row:', err.message);
        }
      }
    } else if (tableName === 'quotes') {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO quotes (id, text, author, tags, url)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < data.length; i++) {
        const q = data[i];
        if (!q.text) continue;

        // Use unique ID per quote to prevent overwrites on identical page URLs
        const id = uuidv4();
        const text = q.text || '';
        const author = q.author || 'Unknown';
        const tags = Array.isArray(q.tags) ? JSON.stringify(q.tags) : (q.tags || '[]');
        const url = q.url || '';

        try {
          insertStmt.run(id, text, author, tags, url);
          insertedCount++;
        } catch (err) {
          console.error('Failed to insert quote row:', err.message);
        }
      }
    }

    console.log(`Synced ${insertedCount} ${tableName} records to database`);
    return insertedCount;
  } catch (error) {
    console.error(`Failed to sync ${tableName} to database:`, error);
    return 0;
  }
}

// Check for existing report created today with identical type and filters
function getExistingReport(type, filters = {}) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const targetFilterStr = JSON.stringify(filters || {});

    const stmt = db.prepare(`
      SELECT * FROM reports 
      WHERE report_type = ? 
        AND status = 'completed'
        AND (date(created_at) = ? OR created_at LIKE ?)
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const report = stmt.get(type, today, `${today}%`);
    if (!report) return null;

    let parsed = {};
    try {
      parsed = typeof report.filters === 'string' ? JSON.parse(report.filters) : (report.filters || {});
    } catch {
      parsed = {};
    }

    return JSON.stringify(parsed) === targetFilterStr ? report : null;
  } catch (error) {
    console.error('Error fetching existing report:', error);
    return null;
  }
}

// Create report record with custom ID support
function createReportRecord(type, filters, filePath, status = 'pending', validRecords = 0, customId = null) {
  const id = customId || uuidv4();
  const createdAt = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO reports (id, report_type, filters, file_path, status, valid_records, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id,
    type,
    JSON.stringify(filters || {}),
    filePath,
    status,
    validRecords,
    createdAt
  );

  return { id, filePath, status, valid_records: validRecords, created_at: createdAt };
}

// Update report status and valid records count
function updateReportStatus(id, status, validRecords = null) {
  if (validRecords !== null && validRecords !== undefined) {
    const update = db.prepare(`
      UPDATE reports SET status = ?, valid_records = ? WHERE id = ?
    `);
    update.run(status, validRecords, id);
  } else {
    const update = db.prepare(`
      UPDATE reports SET status = ? WHERE id = ?
    `);
    update.run(status, id);
  }
}

// Retrieve single report by ID
function getReportById(id) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
}

// List all reports ordered by creation date
function listReports() {
  return db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
}

// Get books data with optional filtering
function getBooksData(filters = {}) {
  const { min_rating, max_price } = filters;
  let query = 'SELECT * FROM books';
  const conditions = [];
  const params = [];

  if (min_rating !== undefined && min_rating !== null && min_rating !== '') {
    conditions.push('rating >= ?');
    params.push(Number(min_rating));
  }

  if (max_price !== undefined && max_price !== null && max_price !== '') {
    conditions.push('price <= ?');
    params.push(Number(max_price));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  return db.prepare(query).all(...params);
}

// Get quotes data with optional filtering
function getQuotesData(filters = {}) {
  const { tag, author } = filters;
  let query = 'SELECT * FROM quotes';
  const conditions = [];
  const params = [];

  if (tag) {
    conditions.push('tags LIKE ?');
    params.push(`%${tag}%`);
  }

  if (author) {
    conditions.push('author LIKE ?');
    params.push(`%${author}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  return db.prepare(query).all(...params);
}

// Get generic data fallback
function getGenericData(type, filters = {}) {
  const tableName = type.replace(/s$/, '');
  try {
    let query = `SELECT * FROM ${tableName}`;
    const conditions = [];
    const params = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    return db.prepare(query).all(...params);
  } catch (error) {
    console.error(`Failed to query table ${tableName}:`, error.message);
    return [];
  }
}

module.exports = {
  syncScrapedDataToDb,
  getExistingReport,
  createReportRecord,
  updateReportStatus,
  getReportById,
  listReports,
  getBooksData,
  getQuotesData,
  getGenericData
};