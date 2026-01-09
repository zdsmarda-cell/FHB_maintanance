
import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    
    // Map DB snake_case to Frontend camelCase
    const mappedUsers = rows.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        isBlocked: !!u.isBlocked,
        assignedLocationIds: typeof u.assignedLocationIds === 'string' ? JSON.parse(u.assignedLocationIds || '[]') : u.assignedLocationIds,
        assignedWorkplaceIds: typeof u.assignedWorkplaceIds === 'string' ? JSON.parse(u.assignedWorkplaceIds || '[]') : u.assignedWorkplaceIds,
        // Crucial mapping for approval limits
        approvalLimits: typeof u.approval_limits === 'string' ? JSON.parse(u.approval_limits || '{}') : u.approval_limits
    }));

    res.json(mappedUsers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { name, email, role, phone } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (id, name, email, role, phone, isBlocked, assignedLocationIds, assignedWorkplaceIds, approval_limits) VALUES (UUID(), ?, ?, ?, ?, 0, "[]", "[]", "{}")',
      [name, email, role, phone]
    );
    // Fetch created
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update User
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, role, phone, isBlocked, assignedLocationIds, assignedWorkplaceIds, approvalLimits } = req.body;
    
    try {
        // Ensure approvalLimits is an object before stringifying, or handle undefined
        const limitsJson = approvalLimits ? JSON.stringify(approvalLimits) : '{}';
        
        await pool.query(
            `UPDATE users SET name=?, email=?, role=?, phone=?, isBlocked=?, assignedLocationIds=?, assignedWorkplaceIds=?, approval_limits=? WHERE id=?`,
            [name, email, role, phone, isBlocked, JSON.stringify(assignedLocationIds), JSON.stringify(assignedWorkplaceIds), limitsJson, id]
        );
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
