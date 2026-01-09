
import pool from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const initDb = async () => {
  try {
    console.log('Initializing database check...');

    // 1. Users (Added approvalLimits)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        phone VARCHAR(50),
        isBlocked BOOLEAN DEFAULT FALSE,
        assignedLocationIds JSON,
        assignedWorkplaceIds JSON,
        approval_limits JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Technologies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS technologies (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        serial_number VARCHAR(255),
        description TEXT,
        tech_type_id VARCHAR(255),
        state_id VARCHAR(255),
        workplace_id VARCHAR(255),
        supplier_id VARCHAR(255),
        install_date DATE,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Maintenance Templates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenances (
        id VARCHAR(255) PRIMARY KEY,
        tech_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        interval_days INT DEFAULT 30,
        allowed_days JSON, 
        last_generated_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        supplier_id VARCHAR(255),
        responsible_person_ids JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 4. Requests (Added estimated_cost, is_approved, history and TITLE)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id VARCHAR(255) PRIMARY KEY,
        tech_id VARCHAR(255) NOT NULL,
        maintenance_id VARCHAR(255),
        title VARCHAR(50), -- Increased buffer for DB, UI enforces 20
        author_id VARCHAR(255) NOT NULL,
        solver_id VARCHAR(255),
        description TEXT,
        priority VARCHAR(50) DEFAULT 'basic',
        state VARCHAR(50) DEFAULT 'new',
        planned_resolution_date DATE,
        estimated_cost DECIMAL(10, 2) DEFAULT 0,
        is_approved BOOLEAN DEFAULT FALSE,
        history JSON,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Email Queue (Added attachments)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        to_address VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        attachments LONGTEXT, -- JSON or Base64 data
        attempts INT DEFAULT 0,
        sent_at TIMESTAMP NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check for Default Admin
    const adminEmail = 'zdenek.smarda@fhb.sk';
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [adminEmail]);

    if (rows.length === 0) {
      console.log(`Default admin (${adminEmail}) not found. Creating...`);
      
      const passwordHash = await bcrypt.hash('1234', 10);
      const userId = crypto.randomUUID();

      await pool.query(
        `INSERT INTO users (id, name, email, password, role, isBlocked, phone, assignedLocationIds, assignedWorkplaceIds, approval_limits) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, 
          'Zdeněk Šmarda', 
          adminEmail, 
          passwordHash, 
          'admin', 
          false, 
          '', 
          JSON.stringify([]), 
          JSON.stringify([]),
          JSON.stringify({})
        ]
      );
      
      console.log('Default admin created successfully.');
    } else {
      console.log('Default admin already exists.');
    }

  } catch (err) {
    console.error('Database initialization failed:', err);
  }
};
