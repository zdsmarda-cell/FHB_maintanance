
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// GET all locations
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all workplaces
router.get('/workplaces', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM workplaces');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE Location
router.post('/', async (req, res) => {
    const { name, address, isVisible } = req.body;
    try {
        const id = crypto.randomUUID();
        await pool.query('INSERT INTO locations (id, name, address, is_visible) VALUES (?, ?, ?, ?)', 
            [id, name, JSON.stringify(address), isVisible]);
        res.json({ id, name, address, isVisible });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE Workplace
router.post('/workplaces', async (req, res) => {
    const { locationId, name, description, isVisible } = req.body;
    try {
        const id = crypto.randomUUID();
        await pool.query('INSERT INTO workplaces (id, location_id, name, description, is_visible) VALUES (?, ?, ?, ?, ?)', 
            [id, locationId, name, description, isVisible]);
        res.json({ id, locationId, name, description, isVisible });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
