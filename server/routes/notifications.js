
import express from 'express';
import pool from '../db.js';
import { getPublicVapidKey } from '../push.js';

const router = express.Router();

// Get Public Key
router.get('/vapid-key', (req, res) => {
    const key = getPublicVapidKey();
    if (!key) return res.status(500).json({ error: 'VAPID keys not configured' });
    res.json({ key });
});

// Subscribe
router.post('/subscribe', async (req, res) => {
    const subscription = req.body;
    const userId = req.user.id;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }

    try {
        const subString = JSON.stringify(subscription);
        // Avoid duplicates
        const [exists] = await pool.query('SELECT id FROM push_subscriptions WHERE user_id = ? AND subscription = ?', [userId, subString]);
        
        if (exists.length === 0) {
            await pool.query('INSERT INTO push_subscriptions (user_id, subscription) VALUES (?, ?)', [userId, subString]);
        }
        
        res.status(201).json({});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
