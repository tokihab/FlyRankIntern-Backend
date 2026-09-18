const express = require('express');
const router = express.Router();
const { signup, login, logout, getProfile, getDashboard } = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/auth.middleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/profile', requireAuth, getProfile);
router.get('/dashboard', requireAuth, getDashboard);

module.exports = router;
