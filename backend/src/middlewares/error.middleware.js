function errorHandler(err, req, res, next) {
  console.error('Error:', err.message || err);
  
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message || 'Internal Server Error' });
  }

  res.status(500).json({ error: 'Internal Server Error' });
}

module.exports = errorHandler;
