
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// Get Suppliers
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM suppliers');
        const mapped = rows.map(r => ({
            id: r.id,
            name: r.name,
            ic: r.ic,
            dic: r.dic,
            email: r.email,
            phone: r.phone,
            description: r.description,
            address: {
                street: r.street || '',
                number: r.number || '',
                zip: r.zip || '',
                city: r.city || '',
                country: r.country || ''
            }
        }));
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Supplier
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, ic, dic, email, phone, description } = req.body;
    try {
        await pool.query(
            `UPDATE suppliers SET name=?, street=?, number=?, zip=?, city=?, country=?, ic=?, dic=?, email=?, phone=?, description=? WHERE id=?`,
            [name, address.street, address.number, address.zip, address.city, address.country, ic, dic, email, phone, description, id]
        );
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create Supplier
router.post('/', async (req, res) => {
    const { name, address, ic, dic, email, phone, description } = req.body;
    try {
        const id = crypto.randomUUID();
        await pool.query(
            `INSERT INTO suppliers (id, name, street, number, zip, city, country, ic, dic, email, phone, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, address.street, address.number, address.zip, address.city, address.country, ic, dic, email, phone, description]
        );
        res.json({ id, name, address, ic, dic, email, phone, description });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Contacts ---

// Get Contacts for a Supplier
router.get('/:id/contacts', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM supplier_contacts WHERE supplier_id = ?', [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add Contact
router.post('/contacts', async (req, res) => {
    const { supplierId, name, email, phone, position } = req.body;
    try {
        const id = crypto.randomUUID();
        await pool.query('INSERT INTO supplier_contacts (id, supplier_id, name, email, phone, position) VALUES (?, ?, ?, ?, ?, ?)',
            [id, supplierId, name, email, phone, position]);
        res.json({ id, supplierId, name, email, phone, position });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Contact
router.put('/contacts/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, position } = req.body;
    try {
        await pool.query('UPDATE supplier_contacts SET name=?, email=?, phone=?, position=? WHERE id=?',
            [name, email, phone, position, id]);
        res.json({ id, ...req.body });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete Contact
router.delete('/contacts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM supplier_contacts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
