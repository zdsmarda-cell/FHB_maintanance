
import express from 'express';
import pool from '../db.js';
import { getNewRequestEmailBody } from '../templates/email.js';

const router = express.Router();

// Helper to map DB columns to Frontend Model
const mapToModel = (r) => ({
    id: r.id,
    techId: r.tech_id,
    maintenanceId: r.maintenance_id,
    title: r.title,
    authorId: r.author_id,
    solverId: r.solver_id,
    assignedSupplierId: r.assigned_supplier_id,
    description: r.description,
    priority: r.priority,
    state: r.state,
    plannedResolutionDate: r.planned_resolution_date,
    estimatedCost: r.estimated_cost,
    estimatedTime: r.estimated_time,
    photoUrls: typeof r.photo_urls === 'string' ? JSON.parse(r.photo_urls || '[]') : (r.photo_urls || []),
    isApproved: !!r.is_approved,
    cancellationReason: r.cancellation_reason,
    history: typeof r.history === 'string' ? JSON.parse(r.history || '[]') : (r.history || []),
    createdDate: r.created_date
});

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000; // Increased limit for easier filtering on frontend
  const offset = (page - 1) * limit;

  try {
    // Get total count
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM requests');
    const total = countResult[0].count;

    // Get paginated data
    const [rows] = await pool.query('SELECT * FROM requests ORDER BY created_date DESC LIMIT ? OFFSET ?', [limit, offset]);
    
    res.set('X-Total-Count', total);
    res.json(rows.map(mapToModel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { techId, authorId, description, priority, title, estimatedCost, estimatedTime, photoUrls, assignedSupplierId, plannedResolutionDate } = req.body;
  try {
    // Initialize history
    const history = [{
        date: new Date().toISOString(),
        userId: authorId,
        action: 'created',
        note: 'Request created'
    }];

    // 1. Create Request
    const [result] = await pool.execute(
      `INSERT INTO requests (
        id, tech_id, author_id, description, priority, title, is_approved, history,
        estimated_cost, estimated_time, photo_urls, assigned_supplier_id, planned_resolution_date, state
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      [
        techId, authorId, description, priority, title || 'Nový požadavek', false, JSON.stringify(history),
        estimatedCost || 0, estimatedTime || 0, JSON.stringify(photoUrls || []), assignedSupplierId, plannedResolutionDate || null
      ]
    );
    
    // Fetch the newly created ID (using UUID() in insert means we can't rely on insertId directly for uuid, but we can query by created_at or similar, 
    // OR better practice: generate UUID in JS. For now, let's select the latest for this author/tech)
    const [newRequest] = await pool.query('SELECT * FROM requests WHERE tech_id = ? AND author_id = ? ORDER BY created_date DESC LIMIT 1', [techId, authorId]);
    
    // 2. Queue Email to Maintenance using Template
    const emailBody = getNewRequestEmailBody(priority, description);
    
    await pool.execute(
      'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
      ['maintenance@tech.com', `Nový požadavek: ${title || priority}`, emailBody]
    );

    res.json(mapToModel(newRequest[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    try {
        // Construct dynamic query based on what's provided
        const updates = [];
        const values = [];

        if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
        if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
        if (body.priority !== undefined) { updates.push('priority = ?'); values.push(body.priority); }
        if (body.state !== undefined) { updates.push('state = ?'); values.push(body.state); }
        if (body.solverId !== undefined) { updates.push('solver_id = ?'); values.push(body.solverId || null); } // Handle empty string as null
        if (body.assignedSupplierId !== undefined) { updates.push('assigned_supplier_id = ?'); values.push(body.assignedSupplierId); }
        if (body.estimatedCost !== undefined) { updates.push('estimated_cost = ?'); values.push(body.estimatedCost); }
        if (body.estimatedTime !== undefined) { updates.push('estimated_time = ?'); values.push(body.estimatedTime); }
        if (body.plannedResolutionDate !== undefined) { updates.push('planned_resolution_date = ?'); values.push(body.plannedResolutionDate || null); }
        if (body.cancellationReason !== undefined) { updates.push('cancellation_reason = ?'); values.push(body.cancellationReason); }
        if (body.isApproved !== undefined) { updates.push('is_approved = ?'); values.push(body.isApproved ? 1 : 0); }
        if (body.photoUrls !== undefined) { updates.push('photo_urls = ?'); values.push(JSON.stringify(body.photoUrls)); }
        
        // Append history logic could be here, but for simplicity we rely on frontend sending just the fields to update 
        // or we fetch-modify-save history. For this implementation, we assume basic field updates.
        
        if (updates.length === 0) return res.json({ message: 'No changes' });

        const sql = `UPDATE requests SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);

        await pool.execute(sql, values);
        
        const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [id]);
        res.json(mapToModel(updated[0]));

    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM requests WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
