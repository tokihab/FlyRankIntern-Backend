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
const { inngest } = require('../inngest/client');
const { createJobReport, getJobReport, listAllJobReports } = require('../services/job-report.service');
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

// GET /reports - List all reports (both in-memory jobs and SQLite PDF reports)
router.get('/', (req, res) => {
  try {
    const jobReports = listAllJobReports();
    const dbReports = listReports();
    
    const formattedDbReports = (dbReports || []).map(report => {
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
    
    const allReports = [
      ...jobReports.map(r => ({ ...r, source: 'job' })),
      ...formattedDbReports.map(r => ({ ...r, source: 'pdf' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return res.status(200).json(allReports);
  } catch (error) {
    console.error('Error listing reports:', error);
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});

// POST /reports - Create report with idempotency check (polymorphic)
router.post('/', async (req, res) => {
  try {
    // Handle A7 background job reports (topic-based)
    if (req.body && req.body.topic !== undefined) {
      const { topic } = req.body;
      
      // Validate topic
      if (typeof topic !== 'string' || !topic.trim()) {
        return res.status(400).json({ error: 'Valid non-empty topic is required' });
      }
      
      // Generate UUID and create job report
      const reportId = uuidv4();
      createJobReport(reportId, topic.trim());
      
      // Send Inngest event
      await inngest.send({
        name: 'report/requested',
        data: {
          id: reportId,
          topic: topic.trim()
        }
      });
      
      // Return 202 Accepted with pending status
      return res.status(202).json({
        id: reportId,
        status: 'pending'
      });
    }

    // Handle PDF scraper reports (type-based)
    if (req.body && req.body.type !== undefined) {
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
    }

    // Invalid request
    return res.status(400).json({ error: 'Either topic or type is required' });
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

// DELETE /reports/:id - Delete a report (for in-memory job reports and PDF reports)
router.delete('/:id', (req, res) => {
  try {
    const { deleteJobReport } = require('../services/job-report.service');
    const reportId = req.params.id;
    
    // Try to delete from in-memory store first
    const jobDeleted = deleteJobReport(reportId);
    
    if (jobDeleted) {
      return res.status(200).json({ message: 'Job report deleted successfully' });
    }
    
    // Try to delete from SQLite database
    try {
      const db = require('../config/db');
      const stmt = db.prepare('DELETE FROM reports WHERE id = ?');
      const result = stmt.run(reportId);
      
      if (result.changes > 0) {
        return res.status(200).json({ message: 'PDF report deleted successfully' });
      }
    } catch (dbError) {
      console.error('Error deleting from database:', dbError);
    }
    
    return res.status(404).json({ error: 'Report not found' });
  } catch (error) {
    console.error('Error deleting report:', error);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
});

// GET /reports/:id - Get report metadata (checks in-memory first, then SQLite)
router.get('/:id', (req, res) => {
  try {
    // 1. Check in-memory background job store first
    const jobReport = getJobReport(req.params.id);
    if (jobReport) {
      return res.status(200).json(jobReport);
    }

    // 2. Check SQLite DB for scraper PDF reports
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