const express = require('express');
const router = express.Router();
const path = require('path');
const { getReportData, getDataForPdf } = require('../services/report-query.service');
const { generateAndSavePdf } = require('../services/pdf.service');
const { updateReportStatus, getReportById } = require('../services/report-db.service');

// POST /internal/reports/prepare - Prepare report data
router.post('/reports/prepare', async (req, res) => {
  try {
    const { type, filters = {}, reportId } = req.body;

    if (!type || !['books', 'quotes'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    // Get report data with aggregation
    const reportData = getReportData(type, filters);
    const records = getDataForPdf(type, filters);

    return res.status(200).json({
      success: true,
      reportData,
      recordsCount: records.length
    });
  } catch (error) {
    console.error('Error preparing report:', error);
    return res.status(500).json({ error: 'Failed to prepare report data' });
  }
});

// POST /internal/reports/render - Render and save PDF
router.post('/reports/render', async (req, res) => {
  try {
    const { type, filters = {}, reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    // Get report data
    const reportData = getReportData(type, filters);
    const records = getDataForPdf(type, filters);

    // Generate and save PDF
    const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');
    const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`);
    
    await generateAndSavePdf(reportData, type, reportId);

    // Update report record with file path and record count
    const db = require('../config/db');
    const update = db.prepare(`
      UPDATE reports SET file_path = ?, valid_records = ?, status = ? WHERE id = ?
    `);
    update.run(filePath, records.length, 'completed', reportId);

    return res.status(200).json({
      success: true,
      filePath,
      validRecords: records.length
    });
  } catch (error) {
    console.error('Error rendering report:', error);
    
    // Update report status to failed
    if (req.body.reportId) {
      const db = require('../config/db');
      const update = db.prepare(`UPDATE reports SET status = ? WHERE id = ?`);
      update.run('failed', req.body.reportId);
    }
    
    return res.status(500).json({ error: 'Failed to render PDF' });
  }
});

// POST /internal/reports/finalize - Mark report as complete
router.post('/reports/finalize', (req, res) => {
  try {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const db = require('../config/db');
    const update = db.prepare(`UPDATE reports SET status = ? WHERE id = ?`);
    update.run('completed', reportId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error finalizing report:', error);
    return res.status(500).json({ error: 'Failed to finalize report' });
  }
});

module.exports = router;
