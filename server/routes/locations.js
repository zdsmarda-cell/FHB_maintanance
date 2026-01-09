
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// GET all locations
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations');
    // Map DB columns to frontend interface
    const mapped = rows.map(r => ({
        id: r.id,
        name: r.name,
        address: typeof r.address === 'string' ? JSON.parse(r.address) : r.address,
        isVisible: !!r.is_visible // Map is_visible -> isVisible
    }));
    res.json(mapped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE Location
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, isVisible } = req.body;
    try {
        await pool.query('UPDATE locations SET name=?, address=?, is_visible=? WHERE id=?', 
            [name, JSON.stringify(address), isVisible, id]);
        res.json({ id, ...req.body });
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

// --- WORKPLACES ---

// GET all workplaces
router.get('/workplaces', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM workplaces');
    // Map DB columns to frontend interface to fix visibility issue
    const mapped = rows.map(r => ({
        id: r.id,
        locationId: r.location_id, // Map location_id -> locationId
        name: r.name,
        description: r.description,
        isVisible: !!r.is_visible // Map is_visible -> isVisible
    }));
    res.json(mapped);
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

// UPDATE Workplace
router.put('/workplaces/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, isVisible } = req.body;
    try {
        await pool.query('UPDATE workplaces SET name=?, description=?, is_visible=? WHERE id=?', 
            [name, description, isVisible, id]);
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE Workplace
router.delete('/workplaces/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check for dependencies (Technology)
        const [techs] = await pool.query('SELECT id FROM technologies WHERE workplace_id = ?', [id]);
        if (techs.length > 0) {
            return res.status(400).json({ error: 'Cannot delete workplace used by technologies.' });
        }
        await pool.query('DELETE FROM workplaces WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
