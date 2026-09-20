const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const authRoutes = require('./src/routes/auth.routes');
const taskRoutes = require('./src/routes/task.routes');
const triageRoutes = require('./src/routes/triage.routes');
const scraperRoutes = require('./src/routes/scraper.routes');
const healthRoutes = require('./src/routes/health.routes');
const reportsRoutes = require('./src/routes/reports.routes');
const internalRoutes = require('./src/routes/internal.routes');
const inngestRoutes = require('./src/routes/inngest.routes');
const errorHandler = require('./src/middlewares/error.middleware');

const app = express();

// 1. CORS middleware (automatically handles OPTIONS preflights for all routes)
app.use(cors({
  origin: ['http://localhost:3002', 'http://127.0.0.1:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Documentation & endpoints
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks', '/auth', '/triage', '/scraper', '/reports'] });
});

app.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

// 4. Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/triage', triageRoutes);
app.use('/scraper', scraperRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/health', healthRoutes);
app.use('/reports', reportsRoutes);
app.use('/internal', internalRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/inngest', inngestRoutes);

// 5. Error handler
app.use(errorHandler);

module.exports = app;