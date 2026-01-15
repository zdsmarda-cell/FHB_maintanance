
import express from 'express';
import pool from '../db.js';
import { sendPushToUser } from '../push.js';

const router = express.Router();

// GET Logs with Filters
router.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { userId, dateFrom, dateTo } = req.query;

    let query = 'SELECT p.*, u.name as user_name FROM push_logs p LEFT JOIN users u ON p.user_id = u.id WHERE 1=1';
    const params = [];

    if (userId) {
        query += ' AND p.user_id = ?';
        params.push(userId);
    }
    if (dateFrom) {
        query += ' AND DATE(p.created_at) >= ?';
        params.push(dateFrom);
    }
    if (dateTo) {
        query += ' AND DATE(p.created_at) <= ?';
        params.push(dateTo);
    }

    // Count for Pagination
    const [countResult] = await pool.query(`SELECT COUNT(*) as count FROM (${query}) as t`, params);
    const total = countResult[0].count;

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    res.set('X-Total-Count', total);
    res.json(rows);
});

// POST Retry
router.post('/:id/retry', async (req, res) => {
    const { id } = req.params;
    
    try {
        const [rows] = await pool.query('SELECT * FROM push_logs WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Log not found' });
        
        const log = rows[0];
        
        // Resend
        await sendPushToUser(log.user_id, {
            title: log.title,
            body: log.body,
            url: '/' // Default to root as URL isn't stored in log currently, can be improved
        });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
