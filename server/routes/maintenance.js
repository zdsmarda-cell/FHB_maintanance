
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

// GET History Logs
router.get('/:id/history', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM maintenance_logs WHERE maintenance_id = ? ORDER BY created_at DESC', [id]);
        res.json(rows.map(r => ({
            id: r.id,
            maintenanceId: r.maintenance_id,
            createdAt: r.created_at,
            executedAt: r.executed_at,
            status: r.status,
            errorMessage: r.error_message,
            requestId: r.request_id
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    const data = req.body;
    const id = crypto.randomUUID();
    try {
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

// Force Run Maintenance NOW (Updated to use logs)
router.post('/:id/run', async (req, res) => {
    const { id } = req.params;
    try {
        const [templates] = await pool.query('SELECT * FROM maintenances WHERE id = ?', [id]);
        if (templates.length === 0) return res.status(404).json({ error: 'Template not found' });
        
        const template = templates[0];
        const todayStr = new Date().toISOString().split('T')[0];
        const logId = crypto.randomUUID();

        // 1. Log Start
        await pool.execute(
            `INSERT INTO maintenance_logs (id, maintenance_id, status, template_snapshot, created_at) 
             VALUES (?, ?, 'pending', ?, NOW())`,
            [logId, template.id, JSON.stringify(template)]
        );

        try {
            const responsibleIds = template.responsible_person_ids ? (typeof template.responsible_person_ids === 'string' ? JSON.parse(template.responsible_person_ids) : template.responsible_person_ids) : [];
            const solverId = responsibleIds.length > 0 ? responsibleIds[0] : null;
            const state = solverId ? 'assigned' : 'new';
            const authorId = req.user?.id || 'system';
            const requestId = crypto.randomUUID();

            await pool.execute(
                `INSERT INTO requests (id, tech_id, maintenance_id, title, author_id, solver_id, description, priority, state, planned_resolution_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'priority', ?, ?)`,
                [requestId, template.tech_id, template.id, template.title, authorId, solverId, template.description, state, todayStr]
            );

            await pool.execute('UPDATE maintenances SET last_generated_at = ? WHERE id = ?', [todayStr, id]);
            
            // Log Success
            await pool.execute(
                `UPDATE maintenance_logs SET status = 'success', executed_at = NOW(), request_id = ? WHERE id = ?`,
                [requestId, logId]
            );

            res.json({ success: true, message: 'Maintenance request created successfully' });
        } catch (createErr) {
            // Log Error
            await pool.execute(
                `UPDATE maintenance_logs SET status = 'error', executed_at = NOW(), error_message = ? WHERE id = ?`,
                [createErr.message, logId]
            );
            throw createErr;
        }
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
