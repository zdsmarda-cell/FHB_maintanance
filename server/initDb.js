
import pool from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// --- MIGRATION DEFINITIONS ---
// Define all schema changes here in order.
// 'up' contains the SQL to apply the change.
const migrations = [
    {
        name: '001_initial_schema',
        up: [
            `CREATE TABLE IF NOT EXISTS users (
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
            )`,
            `CREATE TABLE IF NOT EXISTS locations (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address JSON,
                is_visible BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS workplaces (
                id VARCHAR(255) PRIMARY KEY,
                location_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_visible BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS suppliers (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address JSON,
                ic VARCHAR(50),
                dic VARCHAR(50),
                email VARCHAR(255),
                phone VARCHAR(50),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS supplier_contacts (
                id VARCHAR(255) PRIMARY KEY,
                supplier_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                position VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS tech_types (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS tech_states (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS technologies (
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
            )`,
            `CREATE TABLE IF NOT EXISTS maintenances (
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
            )`,
            `CREATE TABLE IF NOT EXISTS requests (
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
            )`,
            `CREATE TABLE IF NOT EXISTS request_comments (
                id VARCHAR(255) PRIMARY KEY,
                request_id VARCHAR(255) NOT NULL,
                author_id VARCHAR(255) NOT NULL,
                content TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS email_queue (
                id INT AUTO_INCREMENT PRIMARY KEY,
                to_address VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                attachments LONGTEXT,
                attempts INT DEFAULT 0,
                sent_at TIMESTAMP NULL,
                error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value JSON
            )`,
            `CREATE TABLE IF NOT EXISTS password_resets (
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL PRIMARY KEY,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ]
    },
    {
        name: '002_add_weight_column',
        up: [
            `ALTER TABLE technologies ADD COLUMN IF NOT EXISTS weight INT DEFAULT 0`
        ]
    },
    {
        name: '003_add_sharepoint_link',
        up: [
            `ALTER TABLE technologies ADD COLUMN IF NOT EXISTS sharepoint_link TEXT`
        ]
    },
    {
        name: '004_add_photo_urls',
        up: [
            `ALTER TABLE technologies ADD COLUMN IF NOT EXISTS photo_urls JSON`
        ]
    },
    {
        name: '005_add_estimated_time_requests',
        up: [
            `ALTER TABLE requests ADD COLUMN IF NOT EXISTS estimated_time INT DEFAULT 0`
        ]
    },
    {
        name: '006_add_photo_urls_requests',
        up: [
            `ALTER TABLE requests ADD COLUMN IF NOT EXISTS photo_urls JSON`
        ]
    },
    {
        name: '007_multilingual_support',
        up: [
            `ALTER TABLE tech_types MODIFY name TEXT`,
            `ALTER TABLE tech_states MODIFY name TEXT`,
            `ALTER TABLE locations MODIFY name TEXT`,
            `ALTER TABLE workplaces MODIFY name TEXT`,
            `ALTER TABLE workplaces MODIFY description TEXT`,
            `ALTER TABLE suppliers MODIFY description TEXT`
        ]
    },
    {
        name: '008_maintenance_logs',
        up: [
            `CREATE TABLE IF NOT EXISTS maintenance_logs (
                id VARCHAR(255) PRIMARY KEY,
                maintenance_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                executed_at TIMESTAMP NULL,
                status VARCHAR(50) DEFAULT 'pending',
                error_message TEXT,
                request_id VARCHAR(255),
                template_snapshot JSON
            )`
        ]
    },
    {
        name: '009_fix_request_columns',
        up: [
            `ALTER TABLE requests ADD COLUMN IF NOT EXISTS assigned_supplier_id VARCHAR(255)`,
            `ALTER TABLE requests ADD COLUMN IF NOT EXISTS planned_resolution_date DATE`
        ]
    },
    {
        name: '010_add_cancellation_reason',
        up: [
            `ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`
        ]
    },
    {
        name: '011_add_user_language',
        up: [
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'cs'`
        ]
    },
    {
        name: '012_expand_request_title',
        up: [
            `ALTER TABLE requests MODIFY title TEXT`
        ]
    },
    {
        name: '013_push_subscriptions',
        up: [
            `CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                subscription TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id)
            )`
        ]
    },
    {
        name: '014_push_logs',
        up: [
            `CREATE TABLE IF NOT EXISTS push_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                title VARCHAR(255),
                body TEXT,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT,
                INDEX (user_id)
            )`
        ]
    }
];

export const initDb = async () => {
  try {
    console.log('--- Database Initialization & Migration ---');

    // 1. Ensure Migrations Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Fetch Executed Migrations
    const [executedRows] = await pool.query('SELECT migration_name FROM schema_migrations');
    const executedNames = new Set(executedRows.map(r => r.migration_name));

    // 3. Run Pending Migrations
    let migrationsRun = 0;
    for (const migration of migrations) {
        if (!executedNames.has(migration.name)) {
            console.log(`Executing migration: ${migration.name}`);
            
            // Execute all SQL statements in the 'up' array
            for (const sql of migration.up) {
                try {
                    await pool.query(sql);
                } catch (sqlErr) {
                    // Ignore "Duplicate column name" error if manual patch was applied, but log others
                    if (sqlErr.code !== 'ER_DUP_FIELDNAME') {
                        throw sqlErr;
                    } else {
                        console.log(`Skipping duplicate field error in migration ${migration.name}`);
                    }
                }
            }

            // Record migration as done
            await pool.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [migration.name]);
            migrationsRun++;
        }
    }

    if (migrationsRun === 0) {
        console.log('Database Schema is up to date.');
    } else {
        console.log(`Successfully applied ${migrationsRun} migrations.`);
    }

    // 4. Default Admin (Idempotent Check)
    const adminEmail = 'zdenek.smarda@fhb.sk';
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (users.length === 0) {
      console.log('Creating default admin user...');
      const passwordHash = await bcrypt.hash('1234', 10);
      const userId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO users (id, name, email, password, role, isBlocked, phone, assignedLocationIds, assignedWorkplaceIds, approval_limits, language) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cs')`,
        [userId, 'Zdeněk Šmarda', adminEmail, passwordHash, 'admin', false, '', '[]', '[]', '{}']
      );
    }

    console.log('--- Initialization Complete ---');
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1); // Exit process on critical DB failure
  }
};
