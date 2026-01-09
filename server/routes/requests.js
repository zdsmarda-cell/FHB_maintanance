
import express from 'express';
import pool from '../db.js';
import { getNewRequestEmailBody } from '../templates/email.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  try {
    // Get total count
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM requests');
    const total = countResult[0].count;

    // Get paginated data
    const [rows] = await pool.query('SELECT * FROM requests ORDER BY created_date DESC LIMIT ? OFFSET ?', [limit, offset]);
    
    res.set('X-Total-Count', total);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { techId, authorId, description, priority, title } = req.body;
  try {
    // Initialize history
    const history = [{
        date: new Date().toISOString(),
        userId: authorId,
        action: 'created',
        note: 'Request created'
    }];

    // 1. Create Request (is_approved defaults to FALSE now)
    const [result] = await pool.execute(
      'INSERT INTO requests (tech_id, author_id, description, priority, title, is_approved, history) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [techId, authorId, description, priority, title || 'Nový požadavek', false, JSON.stringify(history)]
    );
    
    const [newRequest] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    
    // 2. Queue Email to Maintenance using Template
    const emailBody = getNewRequestEmailBody(priority, description);
    
    await pool.execute(
      'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
      ['maintenance@tech.com', `Nový požadavek: ${title || priority}`, emailBody]
    );

    res.json(newRequest[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
