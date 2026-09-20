const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const scraperValidators = require('../validators/scraper.validator');
const { getReportData, getDataForPdf } = require('../services/report-query.service');
const { generateAndSavePdf } = require('../services/pdf.service');
const { 
  getExistingReport, 
  createReportRecord, 
  updateReportStatus, 
  getReportById, 
  listReports 
} = require('../services/report-db.service');
const { v4: uuidv4 } = require('uuid');

const REPORTS_DIR = path.resolve(__dirname, '..', '..', 'reports');

// Ensure reports output directory exists on disk
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Fallback schema if not exported from scraper.validator.js
const reportGenerationSchema = scraperValidators.reportGenerationSchema || z.object({
  type: z.enum(['books', 'quotes']).default('quotes'),
  filters: z.record(z.any()).optional().default({}),
  force: z.boolean().optional().default(false)
});

// GET /reports - List all reports
router.get('/', (req, res) => {
  try {
    const reports = listReports();
    const formatted = (reports || []).map(report => {
      let parsedFilters = {};
      try {
        parsedFilters = typeof report.filters === 'string' ? JSON.parse(report.filters || '{}') : (report.filters || {});
      } catch {
        parsedFilters = {};
      }
      return {
        ...report,
        filters: parsedFilters,
        file: `/reports/${report.id}/file`
      };
    });
    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error listing reports:', error);
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});

// POST /reports - Create report with idempotency check
router.post('/', async (req, res) => {
  try {
    const validated = reportGenerationSchema.parse(req.body || {});
    const { type, filters = {}, force = false } = validated;

    // Check idempotency - same type and filters within same day
    const existingReport = getExistingReport(type, filters);

    if (existingReport && !force) {
      return res.status(200).json({
        id: existingReport.id,
        file: `/reports/${existingReport.id}/file`,
        cached: true,
        status: existingReport.status,
        valid_records: existingReport.valid_records,
        created_at: existingReport.created_at
      });
    }

    const reportId = uuidv4();
    const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`);
    
    // Save report record with matching reportId
    createReportRecord(type, filters, filePath, 'pending', 0, reportId);

    // Generate PDF and update database status
    try {
      const reportData = getReportData(type, filters);
      const records = getDataForPdf ? getDataForPdf(type, filters) : (reportData.records || []);
      const recordCount = Array.isArray(records) ? records.length : (reportData.records?.length || 0);

      await generateAndSavePdf(reportData, type, reportId);
      updateReportStatus(reportId, 'completed', recordCount);

      return res.status(201).json({
        id: reportId,
        file: `/reports/${reportId}/file`,
        cached: false,
        status: 'completed',
        valid_records: recordCount,
        created_at: new Date().toISOString()
      });
    } catch (genError) {
      console.error(`Failed to generate PDF for report ${reportId}:`, genError);
      updateReportStatus(reportId, 'failed', 0);
      return res.status(500).json({ error: 'Failed to generate PDF artifact' });
    }
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating report:', error);
    return res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET /reports/:id/file - Stream PDF file
router.get('/:id/file', (req, res) => {
  try {
    const report = getReportById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filePath = path.resolve(report.file_path || path.join(REPORTS_DIR, `${report.id}.pdf`));
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${report.report_type}-report-${report.id}.pdf"`);

    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving PDF file:', error);
    return res.status(500).json({ error: 'Failed to serve PDF file' });
  }
});

// GET /reports/:id - Get report metadata
router.get('/:id', (req, res) => {
  try {
    const report = getReportById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let parsedFilters = {};
    try {
      parsedFilters = typeof report.filters === 'string' ? JSON.parse(report.filters || '{}') : (report.filters || {});
    } catch {
      parsedFilters = {};
    }

    return res.status(200).json({
      id: report.id,
      report_type: report.report_type,
      filters: parsedFilters,
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

module.exports = router;