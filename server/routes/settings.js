
import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'global'");
    
    let settings = rows[0]?.setting_value || {};
    
    // Recursively parse stringified JSON until it is an object.
    // This handles cases where data was saved as a string inside a JSON column (double serialization).
    while (typeof settings === 'string') {
        try {
            const parsed = JSON.parse(settings);
            // If JSON.parse returns a string again (e.g. '"{\\"a\\":1}"'), loop continues.
            // If it returns an object, we are done.
            settings = parsed;
        } catch (e) {
            console.error('Failed to parse settings JSON:', e);
            // If parsing fails, break the loop and return what we have (or empty object)
            break;
        }
    }

    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    let settings = req.body;
    
    // Sanity check: If we receive the "garbage" object (indexed string), try to recover or fail gracefully
    if (settings && typeof settings === 'object' && '0' in settings && settings['0'] === '{') {
        console.warn("Received malformed settings payload (spread string), attempting to sanitize.");
        // Try to reconstruct values or just reset to empty to avoid corrupting DB further
        // Ideally, we reset to avoid saving garbage.
        settings = {}; 
    }

    try {
        await pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('global', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            [JSON.stringify(settings)]
        );
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
