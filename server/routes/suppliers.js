
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

router.get('/', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM suppliers');
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { name, address, ic, dic, email, phone, description } = req.body;
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO suppliers (id, name, address, ic, dic, email, phone, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, name, JSON.stringify(address), ic, dic, email, phone, description]);
    res.json({ id, name, address, ic, dic, email, phone, description });
});

export default router;
