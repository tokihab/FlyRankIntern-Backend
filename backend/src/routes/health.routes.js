const express = require('express');
const router = express.Router();
const db = require('../config/db');
const env = require('../config/env');
const { supabase, isSupabaseConfigured } = require('../../lib/supabase');

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      db: Boolean(db),
      llm: env.LLM_ENABLED && !env.LLM_KILL_SWITCH,
      auth: isSupabaseConfigured
    }
  });
});

module.exports = router;
