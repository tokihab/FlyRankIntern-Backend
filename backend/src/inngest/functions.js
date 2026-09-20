const { inngest } = require('./client');
const { 
  getJobReport, 
  updateJobReport, 
  getJobReportCounts 
} = require('../services/job-report.service');

// 1. say-hello: simple 5s sleep function
const sayHello = inngest.createFunction(
  { 
    id: 'say-hello',
    triggers: [{ event: 'test/hello' }]
  },
  async ({ step }) => {
    await step.sleep('wait-a-bit', '5s');
    return 'Hello from the background!';
  }
);

// 2. make-report: 3-step durable function with retries, concurrency, idempotency, and native onFailure
const makeReport = inngest.createFunction(
  {
    id: 'make-report',
    retries: 2,
    concurrency: [{ limit: 2 }],
    triggers: [{ event: 'report/requested' }],
    onFailure: async ({ event, error }) => {
      const originalEvent = event.data?.event;
      const reportId = originalEvent?.data?.id;
      if (reportId) {
        updateJobReport(reportId, {
          status: 'failed',
          error: error?.message || event.data?.error?.message || 'The report oven is broken!'
        });
      }
    }
  },
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

// 3. Cron heartbeat running every minute
const heartbeat = inngest.createFunction(
  { 
    id: 'heartbeat',
    triggers: [{ cron: '* * * * *' }]
  },
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
  heartbeat
};