const express = require('express');
const app = express();
const port = 3000;

// Stage 1: Root endpoint describing the API
app.get('/', (req, res) => {
  res.json({ name: "Task API", version: "1.0", endpoints: ["/tasks"] });
});

// Stage 1: Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Stage 0: Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});