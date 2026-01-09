
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
    workplaceId: r.workplace_id,
    supplierId: r.supplier_id,
    installDate: r.install_date,
    weight: r.weight,
    sharepointLink: r.sharepoint_link,
    photoUrls: typeof r.photo_urls === 'string' ? JSON.parse(r.photo_urls || '[]') : (r.photo_urls || []),
    isVisible: !!r.is_visible
});

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000; // Default high limit for list view if not specified
  const offset = (page - 1) * limit;

  try {
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM technologies');
    const total = countResult[0].count;

    const [rows] = await pool.query('SELECT * FROM technologies ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    
    res.set('X-Total-Count', total);
    res.json(rows.map(mapToModel));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    const { 
        name, serialNumber, description, typeId, stateId, workplaceId, 
        supplierId, installDate, weight, sharepointLink, photoUrls, isVisible 
    } = req.body;

    const id = crypto.randomUUID();

    try {
        await pool.query(
            `INSERT INTO technologies (
                id, name, serial_number, description, tech_type_id, state_id, workplace_id, 
                supplier_id, install_date, weight, sharepoint_link, photo_urls, is_visible
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, name, serialNumber, description, typeId, stateId, workplaceId,
                supplierId, installDate || null, weight || 0, sharepointLink, 
                JSON.stringify(photoUrls || []), isVisible
            ]
        );
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        name, serialNumber, description, typeId, stateId, workplaceId, 
        supplierId, installDate, weight, sharepointLink, photoUrls, isVisible 
    } = req.body;

    try {
        await pool.query(
            `UPDATE technologies SET 
                name=?, serial_number=?, description=?, tech_type_id=?, state_id=?, workplace_id=?, 
                supplier_id=?, install_date=?, weight=?, sharepoint_link=?, photo_urls=?, is_visible=?
            WHERE id=?`,
            [
                name, serialNumber, description, typeId, stateId, workplaceId,
                supplierId, installDate || null, weight || 0, sharepointLink, 
                JSON.stringify(photoUrls || []), isVisible, id
            ]
        );
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check requests dependency
        const [reqs] = await pool.query('SELECT id FROM requests WHERE tech_id = ?', [id]);
        if (reqs.length > 0) {
            return res.status(400).json({ error: 'Cannot delete technology associated with requests.' });
        }

        await pool.query('DELETE FROM technologies WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
