
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
        language: u.language || 'cs', // Added language
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
  const { name, email, role, phone, language } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (id, name, email, role, phone, isBlocked, assignedLocationIds, assignedWorkplaceIds, approval_limits, language) VALUES (UUID(), ?, ?, ?, ?, 0, "[]", "[]", "{}", ?)',
      [name, email, role, phone, language || 'cs']
    );
    // Fetch created
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update User
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, role, phone, isBlocked, assignedLocationIds, assignedWorkplaceIds, approvalLimits, language } = req.body;
    
    try {
        // Ensure approvalLimits is an object before stringifying, or handle undefined
        const limitsJson = approvalLimits ? JSON.stringify(approvalLimits) : '{}';
        
        // Dynamic query construction to allow partial updates (e.g. just language)
        let query = 'UPDATE users SET ';
        const params = [];
        const updates = [];

        if (name !== undefined) { updates.push('name=?'); params.push(name); }
        if (email !== undefined) { updates.push('email=?'); params.push(email); }
        if (role !== undefined) { updates.push('role=?'); params.push(role); }
        if (phone !== undefined) { updates.push('phone=?'); params.push(phone); }
        if (isBlocked !== undefined) { updates.push('isBlocked=?'); params.push(isBlocked); }
        if (assignedLocationIds !== undefined) { updates.push('assignedLocationIds=?'); params.push(JSON.stringify(assignedLocationIds)); }
        if (assignedWorkplaceIds !== undefined) { updates.push('assignedWorkplaceIds=?'); params.push(JSON.stringify(assignedWorkplaceIds)); }
        if (approvalLimits !== undefined) { updates.push('approval_limits=?'); params.push(limitsJson); }
        if (language !== undefined) { updates.push('language=?'); params.push(language); }

        if (updates.length === 0) return res.json({ message: 'No changes' });

        query += updates.join(', ') + ' WHERE id=?';
        params.push(id);

        await pool.query(query, params);
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
