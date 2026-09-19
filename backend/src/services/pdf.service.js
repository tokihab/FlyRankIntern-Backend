const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');

// Ensure reports directory exists
function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Generate HTML template for PDF
function generateHtmlTemplate(reportData, type) {
  const date = new Date().toISOString();
  const title = type === 'books' ? 'Books Report' : 'Quotes Report';
  const summary = reportData.summary || {};
  const records = reportData.records || [];
  
  // Format date for display
  const formattedDate = new Date(date).toLocaleString();
  
  // Build KPI cards
  const kpiCards = [];
  
  if (type === 'books') {
    kpiCards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Total Books</div>
        <div class="kpi-value">${summary.total_count || 0}</div>
      </div>
    `);
    
    kpiCards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Average Price</div>
        <div class="kpi-value">\u00a3${(summary.average_price || 0).toFixed(2)}</div>
      </div>
    `);
  } else {
    kpiCards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Total Quotes</div>
        <div class="kpi-value">${summary.total_count || 0}</div>
      </div>
    `);
    
    kpiCards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Top Authors</div>
        <div class="kpi-value">${(summary.top_authors || []).length}</div>
      </div>
    `);
  }
  
  // Build top 5 table
  let topTable = '';
  
  if (type === 'books' && summary.top_expensive) {
    topTable = `
      <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #333;">Top 5 Most Expensive Books</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left;">Title</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: center;">Rating</th>
          </tr>
        </thead>
        <tbody>
          ${summary.top_expensive.map(book => `
            <tr>
              <td style="text-align: left;">${escapeHtml(book.title || 'N/A')}</td>
              <td style="text-align: right;">\u00a3${(book.price || 0).toFixed(2)}</td>
              <td style="text-align: center;">${escapeHtml(book.rating || 'N/A')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (type === 'quotes' && summary.top_authors) {
    topTable = `
      <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #333;">Top 5 Authors</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left;">Author</th>
            <th style="text-align: right;">Count</th>
          </tr>
        </thead>
        <tbody>
          ${summary.top_authors.map(author => `
            <tr>
              <td style="text-align: left;">${escapeHtml(author.author || 'Unknown')}</td>
              <td style="text-align: right;">${author.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  // Build breakdown section
  let breakdownSection = '';
  
  if (type === 'books' && summary.rating_breakdown) {
    breakdownSection = `
      <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #333;">Rating Breakdown</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left;">Rating</th>
            <th style="text-align: right;">Count</th>
          </tr>
        </thead>
        <tbody>
          ${summary.rating_breakdown.map(item => `
            <tr>
              <td style="text-align: left;">${escapeHtml(item.rating || 'Unknown')}</td>
              <td style="text-align: right;">${item.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (type === 'quotes' && summary.tag_breakdown) {
    breakdownSection = `
      <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #333;">Tag Breakdown</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left;">Tag</th>
            <th style="text-align: right;">Count</th>
          </tr>
        </thead>
        <tbody>
          ${summary.tag_breakdown.map(tag => `
            <tr>
              <td style="text-align: left;">${escapeHtml(tag.tag || 'Unknown')}</td>
              <td style="text-align: right;">${tag.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  // Build main data table
  let dataTableHeaders = '';
  let dataTableRows = '';
  
  if (records.length > 0) {
    const firstRecord = records[0];
    const columns = Object.keys(firstRecord).filter(k => !['id', 'url'].includes(k));
    
    dataTableHeaders = `
      <tr>
        ${columns.map(col => `<th style="text-align: left;">${escapeHtml(col.replace(/_/g, ' '))}</th>`).join('')}
      </tr>
    `;
    
    dataTableRows = records.map(record => `
      <tr>
        ${columns.map(col => {
          const value = record[col];
          if (Array.isArray(value)) {
            return `<td style="text-align: left;">${escapeHtml(value.join(', '))}</td>`;
          }
          return `<td style="text-align: left;">${escapeHtml(String(value || ''))}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }
  
  const dataTable = `
    <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #333;">Complete Dataset</h3>
    <table class="data-table">
      <thead>
        ${dataTableHeaders}
      </thead>
      <tbody>
        ${dataTableRows}
      </tbody>
    </table>
  `;
  
  // Filters applied
  const filtersHtml = Object.keys(summary.filters_applied || {}).length > 0 ? `
    <div style="margin-top: 10px; font-size: 12px; color: #666;">
      <strong>Filters:</strong> ${JSON.stringify(summary.filters_applied)}
    </div>
  ` : '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${formattedDate}</title>
  <style>
    @page {
      margin: 15mm;
      size: A4 portrait;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      margin: 0;
      padding: 0;
    }
    
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 5px 0;
      color: #1a202c;
    }
    
    .header .timestamp {
      font-size: 11px;
      color: #718096;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .kpi-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
    }
    
    .kpi-label {
      font-size: 11px;
      color: #718096;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .kpi-value {
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      page-break-inside: auto;
    }
    
    .data-table thead {
      display: table-header-group;
    }
    
    .data-table th {
      background: #f7fafc;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4a5568;
    }
    
    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    
    .data-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    h2 {
      font-size: 16px;
      font-weight: 600;
      color: #1a202c;
      margin: 25px 0 10px 0;
      page-break-after: avoid;
    }
    
    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #2d3748;
      margin: 15px 0 8px 0;
      page-break-after: avoid;
    }
    
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="timestamp">Generated: ${formattedDate}</div>
    ${filtersHtml}
  </div>
  
  <div class="kpi-grid">
    ${kpiCards.join('\n')}
  </div>
  
  ${topTable}
  ${breakdownSection}
  ${dataTable}
</body>
</html>
  `;
}

// Escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate PDF using Playwright
async function generatePdfReport(reportData, type, outputPath) {
  ensureReportsDir();
  
  const html = generateHtmlTemplate(reportData, type);
  
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });
    
    console.log(`PDF generated: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

// Generate PDF and save to reports directory
async function generateAndSavePdf(reportData, type, reportId) {
  ensureReportsDir();
  
  const outputPath = path.join(REPORTS_DIR, `${reportId}.pdf`);
  
  try {
    await generatePdfReport(reportData, type, outputPath);
    
    // Verify file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error(`PDF file not created at ${outputPath}`);
    }
    
    const stats = fs.statSync(outputPath);
    console.log(`PDF saved: ${outputPath} (${stats.size} bytes)`);
    
    return outputPath;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw error;
  }
}

module.exports = {
  generatePdfReport,
  generateAndSavePdf,
  generateHtmlTemplate,
  ensureReportsDir
};
