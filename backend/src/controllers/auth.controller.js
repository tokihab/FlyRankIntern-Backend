const { supabase, isSupabaseConfigured, createTokenClient } = require('../../lib/supabase');

async function signup(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || email.trim() === '' ||
      typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase authentication is not configured' });
  }

  let data;
  let error;

  try {
    ({ data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password
    }));
  } catch (authError) {
    return res.status(400).json({ error: 'Unable to create account' });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json(data);
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || email.trim() === '' ||
      typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase authentication is not configured' });
  }

  let data;
  let error;

  try {
    ({ data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    }));
  } catch (authError) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  if (error || !data.session || !data.user) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  });
}

async function logout(req, res) {
  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: 'Unable to log out' });
  }

  let error;

  try {
    ({ error } = await createTokenClient(req.token).auth.signOut());
  } catch (authError) {
    return res.status(500).json({ error: 'Unable to log out' });
  }

  if (error) {
    return res.status(500).json({ error: 'Unable to log out' });
  }

  return res.status(204).send();
}

function getProfile(req, res) {
  const { id, email, created_at } = req.user;
  res.status(200).json({ id, email, created_at });
}

function getDashboard(req, res) {
  res.status(200).json({
    message: 'Welcome to dashboard',
    user: req.user.email
  });
}

module.exports = {
  signup,
  login,
  logout,
  getProfile,
  getDashboard
};
