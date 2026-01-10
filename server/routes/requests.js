
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
  
  // Logic for assigning solver: Frontend might send solverId if user selected it, or we rely on 'assigned' logic
  // Typically frontend sends solverId if selecting 'Assign to me' or specific user.
  // For safety, let's look at the body for solverId, if not present it remains null (state 'new')
  const solverId = req.body.solverId || null;
  const state = solverId ? 'assigned' : 'new';

  try {
    // Initialize history
    const history = [{
        date: new Date().toISOString(),
        userId: authorId,
        action: 'created',
        note: 'Request created'
    }];

    // Sanitize Date (Strip time if present to avoid MySQL errors)
    const cleanPlannedDate = plannedResolutionDate ? String(plannedResolutionDate).slice(0, 10) : null;

    // 1. Create Request
    const [result] = await pool.execute(
      `INSERT INTO requests (
        id, tech_id, author_id, description, priority, title, is_approved, history,
        estimated_cost, estimated_time, photo_urls, assigned_supplier_id, planned_resolution_date, state, solver_id
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        techId, authorId, description, priority, title || 'Nový požadavek', false, JSON.stringify(history),
        estimatedCost || 0, estimatedTime || 0, JSON.stringify(photoUrls || []), assignedSupplierId, cleanPlannedDate, state, solverId
      ]
    );
    
    // Fetch the newly created ID
    const [newRequest] = await pool.query('SELECT * FROM requests WHERE tech_id = ? AND author_id = ? ORDER BY created_date DESC LIMIT 1', [techId, authorId]);
    
    // 2. Email Logic (Real DB Users)
    const currentUserId = req.user ? req.user.id : authorId; // Logic relies on authenticated user via middleware
    const emailBody = getNewRequestEmailBody(priority, description);
    const emailSubject = `Nový požadavek: ${title || priority}`;

    const recipients = new Set();

    if (solverId) {
        // A) Request is assigned immediately
        // Only send email if I am NOT assigning it to myself
        if (solverId !== currentUserId) {
            const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [solverId]);
            if (users.length > 0 && users[0].email) {
                recipients.add(users[0].email);
            }
        }
    } else {
        // B) Request is unassigned (New) -> Notify all Maintenance staff
        // Exclude the author if they are maintenance to prevent spamming themselves
        const [maintUsers] = await pool.query("SELECT email, id FROM users WHERE role = 'maintenance' AND isBlocked = 0");
        maintUsers.forEach(u => {
            if (u.id !== currentUserId && u.email) {
                recipients.add(u.email);
            }
        });
    }

    // Insert emails into queue
    for (const email of recipients) {
        await pool.execute(
            'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
            [email, emailSubject, emailBody]
        );
    }

    res.json(mapToModel(newRequest[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const currentUserId = req.user ? req.user.id : null;

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
        
        if (body.plannedResolutionDate !== undefined) { 
            // Sanitize Date (Strip time if present)
            const cleanDate = body.plannedResolutionDate ? String(body.plannedResolutionDate).slice(0, 10) : null;
            updates.push('planned_resolution_date = ?'); 
            values.push(cleanDate); 
        }
        
        if (body.cancellationReason !== undefined) { updates.push('cancellation_reason = ?'); values.push(body.cancellationReason); }
        if (body.isApproved !== undefined) { updates.push('is_approved = ?'); values.push(body.isApproved ? 1 : 0); }
        if (body.photoUrls !== undefined) { updates.push('photo_urls = ?'); values.push(JSON.stringify(body.photoUrls)); }
        
        // Critical: Allow updating history
        if (body.history !== undefined) { updates.push('history = ?'); values.push(JSON.stringify(body.history)); }
        
        if (updates.length === 0) return res.json({ message: 'No changes' });

        const sql = `UPDATE requests SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);

        await pool.execute(sql, values);
        
        // --- Email Logic on Assignment (PUT) ---
        // If solverId was changed AND it wasn't a self-assignment
        if (body.solverId && body.solverId !== currentUserId) {
             const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [body.solverId]);
             if (users.length > 0 && users[0].email) {
                 const emailBody = `Byl vám přiřazen požadavek.\n\nZkontrolujte systém FHB Maintein.`;
                 await pool.execute(
                    'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
                    [users[0].email, `Přiřazení úkolu`, emailBody]
                 );
             }
        }

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
