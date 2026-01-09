
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    // Note: In a real app, passwords in DB must be hashed. 
    // This supports both hashed (production) and plain text (legacy/demo) for smooth transition.
    const isMatch = await bcrypt.compare(password, user.password || '') || password === user.password;

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isBlocked) {
        return res.status(403).json({ error: 'User account is blocked' });
    }

    // 3. Generate Token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Return token and user info (excluding password)
    const { password: _, ...userWithoutPass } = user;
    res.json({ token, user: userWithoutPass });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
