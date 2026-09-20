const { inngest } = require('./client');
const { 
  getJobReport, 
  updateJobReport, 
  getJobReportCounts 
} = require('../services/job-report.service');

const sayHello = inngest.createFunction(
  { id: 'say-hello' },
  { event: 'test/hello' },
  async ({ step }) => {
    await step.sleep('wait-a-bit', '5s');
    return 'Hello from the background!';
  }
);

const makeReport = inngest.createFunction(
  {
    id: 'make-report',
    retries: 2,
    concurrency: [{ limit: 2 }]
  },
  { event: 'report/requested' },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    // Idempotency check
    const existing = await step.run('check-idempotency', () => {
      const record = getJobReport(id);
      if (record && record.status === 'done') {
        return { skip: true, record };
      }
      return { skip: false };
    });

    if (existing?.skip) {
      return { message: 'Report already completed', id };
    }

    // Step 1: Durable preparation
    await step.run('prepare-order', () => {
      const record = getJobReport(id);
      if (!record) {
        throw new Error(`Report record ${id} not found in memory`);
      }
      return { id, topic, prepared: true };
    });

    // Step 2: Durable sleep (8s simulation)
    await step.sleep('do-the-slow-work', '8s');

    // Step 3: Build report and finalize
    const result = await step.run('build-report', () => {
      if (topic === 'fail') {
        throw new Error('The report oven is broken!');
      }

      const generatedResult = `Comprehensive executive report on [${topic}]: All 8 metrics analyzed and verified.`;
      updateJobReport(id, {
        status: 'done',
        result: generatedResult
      });

      return { id, topic, result: generatedResult };
    });

    return result;
  }
);

// On-failure handler to mark job as failed in-memory after retry exhaustion
const makeReportFailureHandler = inngest.createFunction(
  { id: 'make-report-failure' },
  { event: 'inngest/function.failed', if: 'event.data.function_id == "make-report"' },
  async ({ event }) => {
    const originalEvent = event.data.event;
    const reportId = originalEvent?.data?.id;
    if (reportId) {
      updateJobReport(reportId, {
        status: 'failed',
        error: event.data.error?.message || 'Report generation failed'
      });
    }
  }
);

const heartbeat = inngest.createFunction(
  { id: 'heartbeat' },
  { cron: '* * * * *' },
  async () => {
    const counts = getJobReportCounts();
    const logLine = `[Heartbeat Cron] Reports status -> Pending: ${counts.pending} | Done: ${counts.done} | Failed: ${counts.failed} (Total: ${counts.total})`;
    console.log(logLine);
    return { counts, timestamp: new Date().toISOString() };
  }
);

module.exports = {
  sayHello,
  makeReport,
  makeReportFailureHandler,
  heartbeat
};
