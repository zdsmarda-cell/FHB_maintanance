
import pool from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const initDb = async () => {
  try {
    console.log('Initializing database schema...');

    // 1. Users
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

    // 2. Locations & Workplaces
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address JSON,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workplaces (
        id VARCHAR(255) PRIMARY KEY,
        location_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Suppliers & Contacts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address JSON,
        ic VARCHAR(50),
        dic VARCHAR(50),
        email VARCHAR(255),
        phone VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_contacts (
        id VARCHAR(255) PRIMARY KEY,
        supplier_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        position VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tech Config (Types & States)
    // REMOVED DESCRIPTION COLUMN
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tech_types (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tech_states (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);

    // 5. Technologies
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
        weight INT,
        sharepoint_link TEXT,
        photo_urls JSON,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Maintenance Templates
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
        type VARCHAR(50) DEFAULT 'planned',
        supplier_id VARCHAR(255),
        responsible_person_ids JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 7. Requests & Comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id VARCHAR(255) PRIMARY KEY,
        tech_id VARCHAR(255) NOT NULL,
        maintenance_id VARCHAR(255),
        title VARCHAR(50),
        author_id VARCHAR(255) NOT NULL,
        solver_id VARCHAR(255),
        assigned_supplier_id VARCHAR(255),
        description TEXT,
        priority VARCHAR(50) DEFAULT 'basic',
        state VARCHAR(50) DEFAULT 'new',
        planned_resolution_date DATE,
        estimated_cost DECIMAL(10, 2) DEFAULT 0,
        estimated_time INT,
        photo_urls JSON,
        is_approved BOOLEAN DEFAULT FALSE,
        cancellation_reason TEXT,
        history JSON,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_comments (
        id VARCHAR(255) PRIMARY KEY,
        request_id VARCHAR(255) NOT NULL,
        author_id VARCHAR(255) NOT NULL,
        content TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Email Queue
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        to_address VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        attachments LONGTEXT,
        attempts INT DEFAULT 0,
        sent_at TIMESTAMP NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. App Settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value JSON
      )
    `);

    // Default Admin
    const adminEmail = 'zdenek.smarda@fhb.sk';
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [adminEmail]);

    if (rows.length === 0) {
      const passwordHash = await bcrypt.hash('1234', 10);
      const userId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO users (id, name, email, password, role, isBlocked, phone, assignedLocationIds, assignedWorkplaceIds, approval_limits) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 'Zdeněk Šmarda', adminEmail, passwordHash, 'admin', false, '', '[]', '[]', '{}']
      );
      console.log('Default admin created.');
    }

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
};
