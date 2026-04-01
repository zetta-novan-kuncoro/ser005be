// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const express = require('express');

// *************** IMPORT MODULE ***************
const { LoginUser, GetCurrentUser, RegisterUser } = require('./auth.helper');
const UserModel = require('./users/user.model');
const config = require('../../core/config');

// *************** VARIABLES ***************
const router = express.Router();

// *************** FUNCTIONS ***************

/**
 * POST /auth/login
 * Authenticates a user and returns a JWT token.
 *
 * Body: { email: string, password: string }
 * Response 200: { token: string, user: { id, email, full_name, role, assigned_applications } }
 * Response 401: { error: 'INVALID_CREDENTIALS', message: string }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'email and password are required.',
      });
    }

    const result = await LoginUser(email, password);
    return res.status(200).json(result);
  } catch (err) {
    if (err.extensions && err.extensions.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    if (err.extensions && err.extensions.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: err.message,
      });
    }
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

/**
 * GET /auth/me
 * Returns the currently authenticated user's profile.
 *
 * Headers: Authorization: Bearer <token>
 * Response 200: { user: { id, email, full_name, role, assigned_applications } }
 * Response 401: { error: 'UNAUTHENTICATED', message: string }
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      });
    }

    const user = await GetCurrentUser(req.user.id);
    return res.status(200).json({ user });
  } catch (err) {
    if (err.extensions && err.extensions.code === 'UNAUTHENTICATED') {
      return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: err.message,
      });
    }
    console.error('[Auth] GetCurrentUser error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

/**
 * POST /auth/logout
 * Stateless JWT logout. The client must discard the token.
 *
 * Headers: Authorization: Bearer <token>
 * Response 200: { success: true }
 */
router.post('/logout', (req, res) => {
  // JWT is stateless — the client is responsible for dropping the token.
  // Optionally we could maintain a token denylist in Redis/DB, but that is out of scope.
  return res.status(200).json({ success: true });
});

/**
 * POST /auth/register
 * Admin seeding endpoint.
 * - Available in non-production environments at all times.
 * - Available in production ONLY when zero users exist in the DB (first-run bootstrap).
 *
 * Body: { email: string, password: string, full_name?: string, role?: 'admin'|'user' }
 * Response 201: { user: { id, email, full_name, role } }
 * Response 403: { error: 'FORBIDDEN', message: string }
 */
router.post('/register', async (req, res) => {
  try {
    // In production, only allow if no users exist yet (first-run bootstrap)
    if (config.isProduction) {
      const userCount = await UserModel.countDocuments();
      if (userCount > 0) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Registration is disabled in production after initial setup.',
        });
      }
    }

    const user = await RegisterUser(req.body);
    return res.status(201).json({ user });
  } catch (err) {
    if (err.extensions && err.extensions.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: err.message,
      });
    }
    if (err.extensions && err.extensions.code === 'CONFLICT') {
      return res.status(409).json({
        error: 'CONFLICT',
        message: err.message,
      });
    }
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error.' });
  }
});

// *************** EXPORT MODULE ***************
module.exports = router;
