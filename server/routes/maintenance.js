
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Updated query to include count of generated requests
        const [rows] = await pool.query(`
            SELECT m.*, (SELECT COUNT(*) FROM requests r WHERE r.maintenance_id = m.id) as request_count 
            FROM maintenances m
        `);
        
        // Parse JSON fields and map DB columns (snake_case) to Frontend Model (camelCase)
        const parsed = rows.map(r => ({
            id: r.id,
            techId: r.tech_id,
            title: r.title,
            description: r.description,
            interval: r.interval_days,
            allowedDays: r.allowed_days ? (typeof r.allowed_days === 'string' ? JSON.parse(r.allowed_days) : r.allowed_days) : [],
            responsiblePersonIds: r.responsible_person_ids ? (typeof r.responsible_person_ids === 'string' ? JSON.parse(r.responsible_person_ids) : r.responsible_person_ids) : [],
            isActive: !!r.is_active,
            supplierId: r.supplier_id,
            lastGeneratedDate: r.last_generated_at,
            createdAt: r.created_at,
            type: r.type,
            generatedRequestCount: r.request_count || 0
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    const data = req.body;
    const id = crypto.randomUUID();
    try {
        // Removed 'type' from query as requested previously
        await pool.query(`INSERT INTO maintenances 
            (id, tech_id, title, description, interval_days, allowed_days, is_active, supplier_id, responsible_person_ids) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.techId, data.title, data.description, data.interval, JSON.stringify(data.allowedDays), data.isActive, data.supplierId, JSON.stringify(data.responsiblePersonIds)]
        );
        res.json({ id, ...data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        await pool.query(`UPDATE maintenances SET 
            tech_id=?, title=?, description=?, interval_days=?, allowed_days=?, is_active=?, supplier_id=?, responsible_person_ids=?
            WHERE id=?`,
            [data.techId, data.title, data.description, data.interval, JSON.stringify(data.allowedDays), data.isActive, data.supplierId, JSON.stringify(data.responsiblePersonIds), id]
        );
        res.json({ id, ...data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM maintenances WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
