
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// --- TYPES ---
router.get('/types', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM tech_types');
    res.json(rows);
});

router.post('/types', async (req, res) => {
    const { name, description } = req.body;
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO tech_types (id, name, description) VALUES (?, ?, ?)', [id, name, description]);
    res.json({ id, name, description });
});

router.put('/types/:id', async (req, res) => {
    const { name, description } = req.body;
    await pool.query('UPDATE tech_types SET name=?, description=? WHERE id=?', [name, description, req.params.id]);
    res.json({ id: req.params.id, name, description });
});

router.delete('/types/:id', async (req, res) => {
    try {
        const [used] = await pool.query('SELECT id FROM technologies WHERE tech_type_id = ?', [req.params.id]);
        if(used.length > 0) return res.status(400).json({error: 'In use'});
        await pool.query('DELETE FROM tech_types WHERE id=?', [req.params.id]);
        res.json({success: true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- STATES ---
router.get('/states', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM tech_states');
    res.json(rows);
});

router.post('/states', async (req, res) => {
    const { name, description } = req.body;
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO tech_states (id, name, description) VALUES (?, ?, ?)', [id, name, description]);
    res.json({ id, name, description });
});

router.put('/states/:id', async (req, res) => {
    const { name, description } = req.body;
    await pool.query('UPDATE tech_states SET name=?, description=? WHERE id=?', [name, description, req.params.id]);
    res.json({ id: req.params.id, name, description });
});

router.delete('/states/:id', async (req, res) => {
    try {
        const [used] = await pool.query('SELECT id FROM technologies WHERE state_id = ?', [req.params.id]);
        if(used.length > 0) return res.status(400).json({error: 'In use'});
        await pool.query('DELETE FROM tech_states WHERE id=?', [req.params.id]);
        res.json({success: true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

export default router;
