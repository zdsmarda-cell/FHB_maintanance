
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

const mapToModel = (r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    deadline: r.deadline,
    isActive: !!r.is_active,
    createdAt: r.created_at
});

// GET All Projects
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json(rows.map(mapToModel));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE Project
router.post('/', async (req, res) => {
    const { name, description, deadline, isActive } = req.body;
    const id = crypto.randomUUID();
    
    // Clean date
    const cleanDeadline = deadline ? deadline.slice(0, 10) : null;

    try {
        await pool.query(
            `INSERT INTO projects (id, name, description, deadline, is_active) VALUES (?, ?, ?, ?, ?)`,
            [id, name, description, cleanDeadline, isActive]
        );
        res.json({ id, name, description, deadline: cleanDeadline, isActive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE Project
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, deadline, isActive } = req.body;
    
    // Clean date
    const cleanDeadline = deadline ? deadline.slice(0, 10) : null;

    try {
        await pool.query(
            `UPDATE projects SET name=?, description=?, deadline=?, is_active=? WHERE id=?`,
            [name, description, cleanDeadline, isActive, id]
        );
        res.json({ id, name, description, deadline: cleanDeadline, isActive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Project
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check for requests usage
        const [used] = await pool.query('SELECT id FROM requests WHERE project_id = ? LIMIT 1', [id]);
        if (used.length > 0) {
            return res.status(400).json({ error: 'Cannot delete project with assigned requests.' });
        }

        await pool.query('DELETE FROM projects WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
