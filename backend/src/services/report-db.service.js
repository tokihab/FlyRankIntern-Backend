const path = require('path');
const db = require('../config/db');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Sync scraped data from JSON files to SQLite database
function syncScrapedDataToDb(type, data) {
  const tableName = type === 'books' ? 'books' : type === 'quotes' ? 'quotes' : null;
  
  if (!tableName || !Array.isArray(data)) {
    console.log(`No data to sync for type: ${type}`);
    return 0;
  }

  const deleteStmt = db.prepare(`DELETE FROM ${tableName}`);
  deleteStmt.run();

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO ${tableName} (id, ${Object.keys(data[0] || {}).filter(k => k !== 'entity').join(', ')})
    VALUES (${Object.keys(data[0] || {}).filter(k => k !== 'entity').map(() => '?').join(', ')})
  `);

  let insertedCount = 0;
  for (const item of data) {
    if (!item.url) continue;
    
    // Map scraper data to database columns
    const values = Object.keys(item).filter(k => k !== 'entity').map(key => {
      if (key === 'tags' && Array.isArray(item[key])) {
        return JSON.stringify(item[key]);
      }
      return item[key];
    });
    
    try {
      insertStmt.run(item.url, ...values.slice(1));
      insertedCount++;
    } catch (error) {
      console.error(`Failed to insert ${tableName} item:`, error.message);
    }
  }

  console.log(`Synced ${insertedCount} ${tableName} records to database`);
  return insertedCount;
}

// Get existing report by type and filters (for idempotency check)
function getExistingReport(type, filters) {
  const today = new Date().toISOString().split('T')[0];
  
  const filterString = JSON.stringify(filters || {});
  const report = db.prepare(`
    SELECT * FROM reports 
    WHERE report_type = ? 
    AND filters = ? 
    AND date(created_at) = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(type, filterString, today);
  
  return report || null;
}

// Create new report record
function createReportRecord(type, filters, filePath, status, validRecords) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  const insert = db.prepare(`
    INSERT INTO reports (id, report_type, filters, file_path, status, valid_records, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  insert.run(id, type, JSON.stringify(filters || {}), filePath, status, validRecords, createdAt);
  
  return { id, filePath, status, created_at: createdAt };
}

// Update report status
function updateReportStatus(id, status) {
  const update = db.prepare(`
    UPDATE reports SET status = ? WHERE id = ?
  `);
  update.run(status, id);
}

// Get report by ID
function getReportById(id) {
  const report = db.prepare(`
    SELECT * FROM reports WHERE id = ?
  `).get(id);
  
  return report || null;
}

// List all reports
function listReports() {
  const reports = db.prepare(`
    SELECT * FROM reports ORDER BY created_at DESC
  `).all();
  
  return reports;
}

// Get books data from database
function getBooksData(filters = {}) {
  const { min_rating, max_price } = filters;
  
  let query = 'SELECT * FROM books';
  const conditions = [];
  const params = [];
  
  if (min_rating !== undefined) {
    conditions.push('rating >= ?');
    params.push(min_rating);
  }
  
  if (max_price !== undefined) {
    conditions.push('price <= ?');
    params.push(max_price);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  const books = db.prepare(query).all(...params);
  return books;
}

// Get quotes data from database
function getQuotesData(filters = {}) {
  const { tag } = filters;
  
  let query = 'SELECT * FROM quotes';
  const conditions = [];
  const params = [];
  
  if (tag) {
    conditions.push('tags LIKE ?');
    params.push(`%${tag}%`);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  const quotes = db.prepare(query).all(...params);
  return quotes;
}

// Get generic data from any table
function getGenericData(type, filters = {}) {
  const tableName = type.replace(/s$/, ''); // Remove trailing 's' if present
  
  try {
    let query = `SELECT * FROM ${tableName}`;
    const conditions = [];
    const params = [];
    
    // Apply generic filters if provided
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    });
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const data = db.prepare(query).all(...params);
    return data;
  } catch (error) {
    console.error(`Failed to query table ${tableName}:`, error.message);
    return [];
  }
}

// Sync generic scraped data to any table
function syncGenericDataToDb(type, data) {
  const tableName = type.replace(/s$/, ''); // Remove trailing 's'
  
  if (!tableName || !Array.isArray(data) || data.length === 0) {
    console.log(`No data to sync for type: ${type}`);
    return 0;
  }

  try {
    // Create table if it doesn't exist (dynamic table creation)
    const firstItem = data[0];
    const columns = Object.keys(firstItem).filter(k => k !== 'entity' && k !== 'url');
    
    // Check if table exists
    const tableCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    
    if (!tableCheck) {
      // Create table dynamically
      const columnDefs = [
        'id TEXT PRIMARY KEY',
        'url TEXT',
        ...columns.map(col => `${col} ${getColumnType(firstItem[col])}`)
      ].join(', ');
      
      db.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`).run();
      console.log(`Created table ${tableName} for type ${type}`);
    }

    // Clear existing data
    const deleteStmt = db.prepare(`DELETE FROM ${tableName}`);
    deleteStmt.run();

    // Insert new data
    const insertColumns = ['id', ...columns.filter(c => c !== 'id')];
    const placeholders = insertColumns.map(() => '?').join(', ');
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO ${tableName} (${insertColumns.join(', ')})
      VALUES (${placeholders})
    `);
    
    let insertedCount = 0;
    for (const item of data) {
      if (!item.url) continue;
      
      const values = insertColumns.map(col => {
        if (col === 'id') return item.url;
        if (Array.isArray(item[col])) {
          return JSON.stringify(item[col]);
        }
        return item[col];
      });
      
      try {
        insertStmt.run(...values);
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert ${tableName} item:`, error.message);
      }
    }

    console.log(`Synced ${insertedCount} ${tableName} records to database`);
    return insertedCount;
  } catch (error) {
    console.error(`Failed to sync generic data for type ${type}:`, error.message);
    return 0;
  }
}

// Helper to determine SQLite column type
function getColumnType(value) {
  if (value === null || value === undefined) return 'TEXT';
  if (typeof value === 'number') return 'REAL';
  if (typeof value === 'boolean') return 'INTEGER';
  return 'TEXT';
}

module.exports = {
  syncScrapedDataToDb,
  syncGenericDataToDb,
  getExistingReport,
  createReportRecord,
  updateReportStatus,
  getReportById,
  listReports,
  getBooksData,
  getQuotesData,
  getGenericData
};
