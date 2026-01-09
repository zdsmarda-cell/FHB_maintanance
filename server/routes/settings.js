
import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT value FROM app_settings WHERE `key` = 'global'");
    res.json(rows[0]?.value ? JSON.parse(rows[0].value) : {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
