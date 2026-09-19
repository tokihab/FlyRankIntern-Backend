const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const authRoutes = require('./src/routes/auth.routes');
const taskRoutes = require('./src/routes/task.routes');
const triageRoutes = require('./src/routes/triage.routes');
const scraperRoutes = require('./src/routes/scraper.routes');
const healthRoutes = require('./src/routes/health.routes');
const errorHandler = require('./src/middlewares/error.middleware');

const app = express();

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks', '/auth', '/triage', '/scraper'] });
});

// Public info endpoint
app.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/triage', triageRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/health', healthRoutes);

// Legacy endpoints for backward compatibility
app.use('/api/scraper', scraperRoutes);
app.use('/api/triage', triageRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app;
