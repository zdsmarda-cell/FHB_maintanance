
import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  try {
    // Get total count
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM technologies');
    const total = countResult[0].count;

    // Get paginated data
    const [rows] = await pool.query('SELECT * FROM technologies LIMIT ? OFFSET ?', [limit, offset]);
    
    // Return standard array for backward compat if no pagination requested, 
    // but better to return object if pagination params present.
    // However, existing frontend expects array. 
    // BUT the prompt says "dotazovani do DB v produkci bude nacitat, jen co se ma na dane strance zobrazit".
    // For this to work seamlessly with an array-expecting frontend without breaking changes, 
    // we might need to send headers or strictly adhere to array.
    // Given the prompt implies updates to the list view, we will return the array 
    // but the frontend "Production Mode" would need to read X-Total-Count header or similar 
    // OR we change the response structure and update the frontend fetcher.
    
    // Since the provided frontend code currently MOCKS the DB and doesn't actually call this endpoint 
    // for the main list (it uses db.technologies.list()), we will update this endpoint to support
    // pagination correctly for a real implementation.
    
    res.set('X-Total-Count', total);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
