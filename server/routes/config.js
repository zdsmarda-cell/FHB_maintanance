
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// Get Types
router.get('/types', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM tech_types');
    res.json(rows);
});

// Get States
router.get('/states', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM tech_states');
    res.json(rows);
});

// Create Type
router.post('/types', async (req, res) => {
    const { name, description } = req.body;
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO tech_types (id, name, description) VALUES (?, ?, ?)', [id, name, description]);
    res.json({ id, name, description });
});

// Create State
router.post('/states', async (req, res) => {
    const { name, description } = req.body;
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO tech_states (id, name, description) VALUES (?, ?, ?)', [id, name, description]);
    res.json({ id, name, description });
});

export default router;
