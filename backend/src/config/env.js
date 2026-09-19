require('dotenv').config();

const env = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
  LLM_API_KEY: process.env.LLM_API_KEY,
  // Updated to a more reliable and faster model
  LLM_MODEL: process.env.LLM_MODEL || 'llama-3.1-8b-instant',
  LLM_ENABLED: process.env.LLM_ENABLED === 'true',
  LLM_KILL_SWITCH: process.env.LLM_KILL_SWITCH === '1' || process.env.LLM_KILL_SWITCH === 'true',
  LLM_STUB: process.env.LLM_STUB === '1',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate required env vars for auth
if (env.NODE_ENV !== 'test' && !env.SUPABASE_URL && env.SUPABASE_KEY) {
  console.warn('Warning: SUPABASE_URL and SUPABASE_KEY should both be set or both unset');
}

// Log LLM configuration for debugging
if (env.LLM_ENABLED) {
  console.log(`LLM Configuration: model=${env.LLM_MODEL}, baseUrl=${env.LLM_BASE_URL}, enabled=${env.LLM_ENABLED}`);
}

module.exports = env;
