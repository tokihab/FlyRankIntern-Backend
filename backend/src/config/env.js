require('dotenv').config();

const env = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_MODEL: process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  LLM_ENABLED: process.env.LLM_ENABLED === 'true',
  LLM_KILL_SWITCH: process.env.LLM_KILL_SWITCH === '1' || process.env.LLM_KILL_SWITCH === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate required env vars for auth
if (env.NODE_ENV !== 'test' && !env.SUPABASE_URL && env.SUPABASE_KEY) {
  console.warn('Warning: SUPABASE_URL and SUPABASE_KEY should both be set or both unset');
}

module.exports = env;
