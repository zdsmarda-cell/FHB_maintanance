
import express from 'express';
import pool from '../db.js';
import { getNewRequestEmailBody } from '../templates/email.js';
import { sendPushToUser } from '../push.js'; // Import Push Helper

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

// Helper to parse localized string
const getLocalized = (data, lang) => {
    if (!data) return '';
    try {
        if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            const parsed = JSON.parse(data);
            return parsed[lang] || parsed['cs'] || parsed['en'] || Object.values(parsed)[0] || data;
        }
        return data;
    } catch (e) {
        return data;
    }
};

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
    
    // Fetch Tech Name for Email
    const [techRows] = await pool.query('SELECT name FROM technologies WHERE id = ?', [techId]);
    const techName = techRows[0]?.name || '';

    // 2. Email & Push Logic (Real DB Users)
    const currentUserId = req.user ? req.user.id : authorId; // Logic relies on authenticated user via middleware
    
    // Map to store Email -> Language and Push IDs
    const recipientsMap = new Map(); // Map<email, language>
    const pushRecipients = new Set(); // Set<userId>

    if (solverId) {
        // A) Request is assigned immediately
        // Only send notification if I am NOT assigning it to myself
        if (solverId !== currentUserId) {
            pushRecipients.add(solverId);
        }
    } else {
        // B) Request is unassigned (New) -> Notify all Maintenance staff (who can take over)
        // Exclude the author if they are maintenance to prevent spamming themselves
        const [maintUsers] = await pool.query("SELECT email, id, language FROM users WHERE role = 'maintenance' AND isBlocked = 0");
        maintUsers.forEach(u => {
            if (u.id !== currentUserId) {
                if (u.email) recipientsMap.set(u.email, u.language || 'cs');
                pushRecipients.add(u.id);
            }
        });
    }

    // Send Emails (Only for New/Unassigned to Maintenance group, NOT for specific assignment to solver)
    for (const [email, lang] of recipientsMap.entries()) {
        const emailData = {
            title: title || 'Bez názvu',
            description: description,
            priority: priority,
            techName: techName,
            photoUrl: (photoUrls && photoUrls.length > 0) ? photoUrls[0] : null
        };

        const { subject, body } = getNewRequestEmailBody(lang, emailData);

        await pool.execute(
            'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
            [email, subject, body]
        );
    }

    // Send Push Notifications
    for (const userId of pushRecipients) {
        // We need to fetch the target user's language to localize the push
        const [users] = await pool.query('SELECT language FROM users WHERE id = ?', [userId]);
        const lang = users[0]?.language || 'cs';
        const localizedTitle = getLocalized(title, lang);
        
        const pushTitle = lang === 'en' ? `New Request: ${localizedTitle}` : (lang === 'uk' ? `Новий запит: ${localizedTitle}` : `Nový požadavek: ${localizedTitle}`);

        sendPushToUser(userId, {
            title: pushTitle,
            body: `${techName} - ${priority}`,
            url: `/requests`
        });
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
        
        // Fetch updated request to get correct title and data
        const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [id]);
        const updatedRequest = updated[0];

        // --- Push Logic on Assignment (PUT) ---
        // Requirement: "Pri prirazeni pozadavku se ma odesilat jen push notifikace, nikoliv i email."
        // And now: Include request name in the push.
        
        // If solverId was provided in body (meaning it's an assignment change) AND it wasn't a self-assignment
        if (body.solverId && body.solverId !== currentUserId) {
             const [users] = await pool.query('SELECT language FROM users WHERE id = ?', [body.solverId]);
             if (users.length > 0) {
                 const user = users[0];
                 const lang = user.language || 'cs';
                 
                 const reqTitle = getLocalized(updatedRequest.title, lang);
                 const subject = lang === 'en' ? 'Task Assigned' : (lang === 'uk' ? 'Призначено завдання' : 'Přiřazení úkolu');
                 const msgBody = lang === 'en' 
                    ? `You have been assigned: ${reqTitle}`
                    : (lang === 'uk' ? `Вам призначено: ${reqTitle}` : `Byl vám přiřazen požadavek: ${reqTitle}`);

                 // Push Notification to Solver
                 sendPushToUser(body.solverId, {
                     title: subject,
                     body: msgBody,
                     url: `/requests`
                 });
             }
        }

        res.json(mapToModel(updatedRequest));

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
