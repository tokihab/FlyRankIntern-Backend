const jobReports = new Map();

function createJobReport(id, topic) {
  const record = {
    id,
    topic,
    status: 'pending',
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  jobReports.set(id, record);
  return record;
}

function getJobReport(id) {
  return jobReports.get(id) || null;
}

function updateJobReport(id, updates) {
  const existing = jobReports.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  jobReports.set(id, updated);
  return updated;
}

function getJobReportCounts() {
  let pending = 0;
  let done = 0;
  let failed = 0;
  for (const report of jobReports.values()) {
    if (report.status === 'pending') pending++;
    else if (report.status === 'done') done++;
    else if (report.status === 'failed') failed++;
  }
  return { pending, done, failed, total: jobReports.size };
}

function listAllJobReports() {
  return Array.from(jobReports.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function deleteJobReport(id) {
  return jobReports.delete(id);
}

module.exports = {
  createJobReport,
  getJobReport,
  updateJobReport,
  getJobReportCounts,
  listAllJobReports,
  deleteJobReport
};
