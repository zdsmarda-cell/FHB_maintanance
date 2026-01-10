
import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'global'");
    
    let settings = rows[0]?.setting_value || {};
    
    // Ensure it is parsed if the DB driver returns a string for JSON column
    if (typeof settings === 'string') {
        try {
            settings = JSON.parse(settings);
        } catch (e) {
            console.error('Failed to parse settings JSON:', e);
            settings = {};
        }
    }

    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    const settings = req.body;
    try {
        await pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('global', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            [JSON.stringify(settings)]
        );
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
