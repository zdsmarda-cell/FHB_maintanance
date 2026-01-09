
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// --- TYPES ---
router.get('/types', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tech_types');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/types', async (req, res) => {
    const { name } = req.body;
    const id = crypto.randomUUID();
    try {
        await pool.query('INSERT INTO tech_types (id, name) VALUES (?, ?)', [id, name]);
        res.json({ id, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/types/:id', async (req, res) => {
    const { name } = req.body;
    try {
        await pool.query('UPDATE tech_types SET name=? WHERE id=?', [name, req.params.id]);
        res.json({ id: req.params.id, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    try {
        const [rows] = await pool.query('SELECT * FROM tech_states');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/states', async (req, res) => {
    const { name } = req.body;
    const id = crypto.randomUUID();
    try {
        await pool.query('INSERT INTO tech_states (id, name) VALUES (?, ?)', [id, name]);
        res.json({ id, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/states/:id', async (req, res) => {
    const { name } = req.body;
    try {
        await pool.query('UPDATE tech_states SET name=? WHERE id=?', [name, req.params.id]);
        res.json({ id: req.params.id, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
