const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const majorVersion = Number(process.versions.node.split('.')[0]);
const supportsSupabaseRuntime = majorVersion >= 22;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = supportsSupabaseRuntime && supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

function createTokenClient(accessToken) {
  if (!supabase) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

module.exports = {
  supabase,
  isSupabaseConfigured: Boolean(supabase),
  createTokenClient
};
