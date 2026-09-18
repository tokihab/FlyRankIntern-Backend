require('./src/config/env');
const app = require('./app');
const env = require('./src/config/env');

const port = env.PORT || 3000;

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
