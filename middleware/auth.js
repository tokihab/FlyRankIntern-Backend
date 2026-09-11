const { supabase, isSupabaseConfigured } = require('../lib/supabase');

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (!isSupabaseConfigured) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const token = match[1];
  let data;
  let error;

  try {
    ({ data, error } = await supabase.auth.getUser(token));
  } catch (authError) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.token = token;
  return next();
}

module.exports = requireAuth;
