const express = require('express');
const router = express.Router();
const { reportGenerationSchema } = require('../validators/scraper.validator');
const { getReportData, getDataForPdf } = require('../services/report-query.service');
const { generateAndSavePdf } = require('../services/pdf.service');
const { getExistingReport, createReportRecord, updateReportStatus, getReportById, listReports } = require('../services/report-db.service');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');

// POST /reports - Create report with idempotency check
router.post('/', async (req, res) => {
  try {
    const validated = reportGenerationSchema.parse(req.body);
    const { type, filters = {}, force = false } = validated;

    // Check idempotency - same type and filters within same day
    const today = new Date().toISOString().split('T')[0];
    const filterString = JSON.stringify(filters || {});
    
    const existingReport = getExistingReport(type, filters);

    if (existingReport && !force) {
      return res.status(200).json({
        id: existingReport.id,
        file: `/reports/${existingReport.id}/file`,
        cached: true,
        status: existingReport.status,
        created_at: existingReport.created_at
      });
    }

    // Create new report record with pending status
    const reportId = uuidv4();
    const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`);
    
    createReportRecord(type, filters, filePath, 'pending', 0);

    // Return 202 Accepted with pending status
    return res.status(202).json({
      id: reportId,
      file: `/reports/${reportId}/file`,
      cached: false,
      status: 'pending',
      message: 'Report generation queued'
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating report:', error);
    return res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET /reports/:id - Get report metadata
router.get('/:id', (req, res) => {
  try {
    const report = getReportById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.status(200).json({
      id: report.id,
      report_type: report.report_type,
      filters: JSON.parse(report.filters || '{}'),
      file: `/reports/${report.id}/file`,
      status: report.status,
      valid_records: report.valid_records,
      created_at: report.created_at
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// GET /reports/:id/file - Stream PDF file
router.get('/:id/file', (req, res) => {
  try {
    const report = getReportById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filePath = report.file_path || path.join(REPORTS_DIR, `${report.id}.pdf`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.sendFile(filePath, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${report.report_type}-report-${report.id}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error serving PDF file:', error);
    return res.status(500).json({ error: 'Failed to serve PDF file' });
  }
});

// GET /reports - List all reports
router.get('/', (req, res) => {
  try {
    const reports = listReports();
    return res.status(200).json(reports);
  } catch (error) {
    console.error('Error listing reports:', error);
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});

module.exports = router;
