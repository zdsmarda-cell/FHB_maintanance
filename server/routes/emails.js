
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get all emails
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Retry
router.post('/retry', async (req, res) => {
  const { ids } = req.body; // Array of IDs
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
  }

  try {
    // Generate placeholders for IN clause
    const placeholders = ids.map(() => '?').join(',');
    
    await pool.execute(
      `UPDATE email_queue 
       SET sent_at = NULL, error = NULL, attempts = 0 
       WHERE id IN (${placeholders})`,
      ids
    );
    
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
