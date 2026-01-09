
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

router.get('/', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM maintenances');
    // Parse JSON fields
    const parsed = rows.map(r => ({
        ...r,
        allowedDays: r.allowed_days ? (typeof r.allowed_days === 'string' ? JSON.parse(r.allowed_days) : r.allowed_days) : [],
        responsiblePersonIds: r.responsible_person_ids ? (typeof r.responsible_person_ids === 'string' ? JSON.parse(r.responsible_person_ids) : r.responsible_person_ids) : []
    }));
    res.json(parsed);
});

router.post('/', async (req, res) => {
    const data = req.body;
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO maintenances 
        (id, tech_id, title, description, interval_days, allowed_days, is_active, type, supplier_id, responsible_person_ids) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.techId, data.title, data.description, data.interval, JSON.stringify(data.allowedDays), data.isActive, data.type, data.supplierId, JSON.stringify(data.responsiblePersonIds)]
    );
    res.json({ id, ...data });
});

export default router;
