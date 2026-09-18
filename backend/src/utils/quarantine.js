const fs = require('fs');
const path = require('path');

function quarantineOutput({ promptVersion, model, rawOutput, error }) {
  const quarantinePath = path.join(__dirname, '..', '..', '..', 'logs', 'quarantine.jsonl');
  fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    prompt_version: promptVersion,
    model,
    raw_output: rawOutput,
    error: error?.message || String(error)
  };
  fs.appendFileSync(quarantinePath, `${JSON.stringify(entry)}\n`);
  return quarantinePath;
}

module.exports = { quarantineOutput };
