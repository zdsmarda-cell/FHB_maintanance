
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// Helper to map DB columns (snake_case) to Frontend model (camelCase)
const mapToModel = (r) => ({
    id: r.id,
    name: r.name,
    serialNumber: r.serial_number,
    description: r.description,
    typeId: r.tech_type_id,
    stateId: r.state_id,
    // Extract array of workplace IDs from grouped result
    workplaceIds: r.workplace_ids ? String(r.workplace_ids).split(',') : [],
    supplierId: r.supplier_id,
    installDate: r.install_date,
    weight: r.weight,
    sharepointLink: r.sharepoint_link,
    photoUrls: typeof r.photo_urls === 'string' ? JSON.parse(r.photo_urls || '[]') : (r.photo_urls || []),
    isVisible: !!r.is_visible
});

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const offset = (page - 1) * limit;

  try {
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM technologies');
    const total = countResult[0].count;

    // Use GROUP_CONCAT to get all workplace IDs for a technology
    const query = `
        SELECT t.*, GROUP_CONCAT(tw.workplace_id) as workplace_ids
        FROM technologies t
        LEFT JOIN technology_workplaces tw ON t.id = tw.tech_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [limit, offset]);
    
    res.set('X-Total-Count', total);
    res.json(rows.map(mapToModel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    const { 
        name, serialNumber, description, typeId, stateId, workplaceIds, 
        supplierId, installDate, weight, sharepointLink, photoUrls, isVisible 
    } = req.body;

    const id = crypto.randomUUID();
    const cleanDate = installDate ? installDate.slice(0, 10) : null;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO technologies (
                id, name, serial_number, description, tech_type_id, state_id, 
                supplier_id, install_date, weight, sharepoint_link, photo_urls, is_visible
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, name, serialNumber, description, typeId, stateId,
                supplierId, cleanDate, weight || 0, sharepointLink, 
                JSON.stringify(photoUrls || []), isVisible
            ]
        );

        // Insert Workplaces Relations
        if (workplaceIds && Array.isArray(workplaceIds) && workplaceIds.length > 0) {
            const values = workplaceIds.map(wpId => [id, wpId]);
            await conn.query(
                `INSERT INTO technology_workplaces (tech_id, workplace_id) VALUES ?`,
                [values]
            );
        }

        await conn.commit();
        res.json({ id, ...req.body });
    } catch (err) { 
        await conn.rollback();
        res.status(500).json({ error: err.message }); 
    } finally {
        conn.release();
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        name, serialNumber, description, typeId, stateId, workplaceIds, 
        supplierId, installDate, weight, sharepointLink, photoUrls, isVisible 
    } = req.body;

    const cleanDate = installDate ? installDate.slice(0, 10) : null;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            `UPDATE technologies SET 
                name=?, serial_number=?, description=?, tech_type_id=?, state_id=?, 
                supplier_id=?, install_date=?, weight=?, sharepoint_link=?, photo_urls=?, is_visible=?
            WHERE id=?`,
            [
                name, serialNumber, description, typeId, stateId,
                supplierId, cleanDate, weight || 0, sharepointLink, 
                JSON.stringify(photoUrls || []), isVisible, id
            ]
        );

        // Update Workplaces Relations (Delete All & Re-Insert)
        await conn.query('DELETE FROM technology_workplaces WHERE tech_id = ?', [id]);
        
        if (workplaceIds && Array.isArray(workplaceIds) && workplaceIds.length > 0) {
            const values = workplaceIds.map(wpId => [id, wpId]);
            await conn.query(
                `INSERT INTO technology_workplaces (tech_id, workplace_id) VALUES ?`,
                [values]
            );
        }

        await conn.commit();
        res.json({ id, ...req.body });
    } catch (err) { 
        await conn.rollback();
        res.status(500).json({ error: err.message }); 
    } finally {
        conn.release();
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [reqs] = await pool.query('SELECT id FROM requests WHERE tech_id = ?', [id]);
        if (reqs.length > 0) {
            return res.status(400).json({ error: 'Cannot delete technology associated with requests.' });
        }

        // Clean up junction table first (though DB constraints might cascade)
        await pool.query('DELETE FROM technology_workplaces WHERE tech_id = ?', [id]);
        await pool.query('DELETE FROM technologies WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
