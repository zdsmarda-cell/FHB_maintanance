import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Users ---
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  const { name, email, role, phone } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, role, phone) VALUES (?, ?, ?, ?)',
      [name, email, role, phone]
    );
    
    // Fetch the created user
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Technologies ---
app.get('/api/technologies', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM technologies');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Requests (With Email Trigger) ---
app.get('/api/requests', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests ORDER BY created_date DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/requests', async (req, res) => {
  const { techId, authorId, description, priority } = req.body;
  try {
    // 1. Create Request
    const [result] = await pool.execute(
      'INSERT INTO requests (tech_id, author_id, description, priority) VALUES (?, ?, ?, ?)',
      [techId, authorId, description, priority]
    );
    
    const [newRequest] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    
    // 2. Queue Email to Maintenance
    await pool.execute(
      'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
      ['maintenance@tech.com', `Nový požadavek: ${priority}`, `Popis: ${description}`]
    );

    res.json(newRequest[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Settings ---
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT value FROM app_settings WHERE `key` = 'global'");
    res.json(rows[0]?.value ? JSON.parse(rows[0].value) : {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
