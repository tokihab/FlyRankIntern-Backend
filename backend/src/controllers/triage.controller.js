const fs = require('fs');
const path = require('path');
const { triageText } = require('../services/llm.service');
const { outputSchema } = require('../validators/triage.validator');

async function triage(req, res) {
  try {
    const result = await triageText(req.body.text);
    const validated = outputSchema.parse(result);
    
    res.set('X-LLM-Model', process.env.LLM_MODEL || 'openai/gpt-oss-120b');
    res.set('X-LLM-Repair-Count', '0');
    
    return res.status(200).json(validated);
  } catch (error) {
    if (error.message === 'Gateway Timeout while calling the model') {
      return res.status(504).json({ error: error.message });
    }
    
    if (error.message === 'Model output was invalid and the repair attempt also failed.') {
      return res.status(422).json({ error: error.message });
    }
    
    if (error.message === 'Model output could not be validated.') {
      return res.status(422).json({ error: error.message });
    }
    
    if (error.message.startsWith('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message });
  }
}

function getQuarantine(req, res) {
  const quarantinePath = path.join(__dirname, '..', '..', '..', 'logs', 'quarantine.jsonl');
  if (!fs.existsSync(quarantinePath)) {
    return res.json([]);
  }

  const entries = fs.readFileSync(quarantinePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-50)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { error: 'Invalid quarantine log entry' };
      }
    });

  return res.json(entries);
}

module.exports = {
  triage,
  getQuarantine
};
