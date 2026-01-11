
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db.js';
import dotenv from 'dotenv';
import { getPasswordResetEmail } from '../templates/email.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password || '') || password === user.password;

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isBlocked) {
        return res.status(403).json({ error: 'User account is blocked' });
    }

    // 3. Generate Tokens
    // Access Token: Short lived (e.g. 15 minutes)
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' } 
    );

    // Refresh Token: Long lived (e.g. 24 hours) - this dictates the auto-logout limit on inactivity logic
    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '24h' }
    );

    // Return token and user info (excluding password)
    const { password: _, ...userWithoutPass } = user;
    res.json({ token: accessToken, refreshToken, user: userWithoutPass });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token Endpoint
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) return res.status(401).json({ error: 'Refresh Token required' });

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        
        // Check if user still exists/is not blocked
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
        const user = rows[0];

        if (!user || user.isBlocked) {
            return res.status(403).json({ error: 'User invalid or blocked' });
        }

        // Issue new Access Token
        const accessToken = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ accessToken });

    } catch (err) {
        return res.status(403).json({ error: 'Invalid Refresh Token' });
    }
});

// Request Password Reset
router.post('/forgot-password', async (req, res) => {
    const { email, lang } = req.body;
    
    try {
        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // For security, do not reveal if email exists, just pretend success
            return res.json({ message: 'If email exists, a link was sent.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiration

        // Save token to DB
        await pool.query('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)', [email, token, expiresAt]);

        // Construct Link
        // Use Origin header to detect where the request came from (e.g., https://fhbmain.impossible.cz)
        const origin = req.headers.origin || 'https://fhbmain.impossible.cz';
        const resetLink = `${origin}?resetToken=${token}`;

        // Get localized email content
        const { subject, body } = getPasswordResetEmail(lang || 'cs', resetLink);

        // Add to email queue
        await pool.query(
            'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
            [email, subject, body]
        );

        res.json({ message: 'Email sent' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: 'Missing token or password' });
    }

    try {
        // 1. Verify Token
        const [resets] = await pool.query('SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()', [token]);
        if (resets.length === 0) {
            return res.status(400).json({ error: 'Neplatný nebo expirovaný odkaz.' });
        }

        const email = resets[0].email;

        // 2. Hash New Password
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Update User
        await pool.query('UPDATE users SET password = ? WHERE email = ?', [passwordHash, email]);

        // 4. Delete Token (Single Use)
        await pool.query('DELETE FROM password_resets WHERE token = ?', [token]);

        res.json({ message: 'Password updated successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Authenticated Password Change
router.post('/change-password', async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    
    if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = rows[0];

        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(oldPassword, user.password || '') || oldPassword === user.password;
        if (!isMatch) {
            return res.status(401).json({ error: 'Old password incorrect' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, userId]);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
