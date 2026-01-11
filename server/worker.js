
import pool from './db.js';
import nodemailer from 'nodemailer';
import { getNewRequestEmailBody, getMaintenanceEmail } from './templates/email.js';
import { checkDailyOverdue } from './workers/dailyOverdue.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // Often needed for self-signed or internal SMTP servers
  }
});

const processEmailQueue = async () => {
  try {
    const [rows] = await pool.query('SELECT * FROM email_queue WHERE sent_at IS NULL AND attempts < 3 LIMIT 10');
    
    if (rows.length === 0) return;

    console.log(`[MAILER] Found ${rows.length} emails to send.`);

    for (const email of rows) {
      try {
        console.log(`[MAILER] Sending to ${email.to_address}: ${email.subject}`);
        
        // Decode Base64 body from DB to UTF-8 HTML string
        const decodedBody = Buffer.from(email.body, 'base64').toString('utf-8');

        const mailOptions = {
          from: process.env.EMAIL_FROM || '"FHB Maintain" <noreply@fhb.sk>',
          to: email.to_address,
          subject: email.subject,
          html: decodedBody, // Send decoded HTML
          attachments: []
        };

        // Handle Attachments (JSON array of { filename, content, encoding })
        if (email.attachments) {
            try {
                const parsedAttachments = JSON.parse(email.attachments);
                if (Array.isArray(parsedAttachments)) {
                    mailOptions.attachments = parsedAttachments;
                }
            } catch (e) {
                console.warn(`[MAILER] Failed to parse attachments for email ${email.id}`, e);
            }
        }

        await transporter.sendMail(mailOptions);
        
        await pool.execute('UPDATE email_queue SET sent_at = NOW() WHERE id = ?', [email.id]);
        console.log(`[MAILER] Email ${email.id} sent successfully.`);
      } catch (sendErr) {
        console.error(`Failed to send email ${email.id}`, sendErr);
        await pool.execute('UPDATE email_queue SET attempts = attempts + 1, error = ? WHERE id = ?', [sendErr.message, email.id]);
      }
    }
  } catch (err) {
    console.error('[MAILER] Error:', err);
  }
};

const generateMaintenanceRequests = async () => {
    try {
        // Fetch active templates WITH tech name for the email
        const [templates] = await pool.query(`
            SELECT m.*, t.name as tech_name 
            FROM maintenances m 
            LEFT JOIN technologies t ON m.tech_id = t.id
            WHERE m.is_active = TRUE
        `);
        
        if(templates.length === 0) return;

        const today = new Date();
        today.setHours(0,0,0,0);

        for (const template of templates) {
            // Determine the base date to calculate next due date
            const lastGenerated = template.last_generated_at ? new Date(template.last_generated_at) : new Date(template.created_at);
            lastGenerated.setHours(0,0,0,0);

            // Calculate theoretical due date
            const nextDueDate = new Date(lastGenerated);
            nextDueDate.setDate(lastGenerated.getDate() + template.interval_days);

            if (nextDueDate > today) continue;

            // Logic: "Save to nearest allowed day"
            let targetDate = new Date(nextDueDate);
            let safetyCounter = 0;
            
            // Safe parsing of allowed_days
            const allowedDaysRaw = template.allowed_days;
            const allowedDays = Array.isArray(allowedDaysRaw) 
                ? allowedDaysRaw 
                : (typeof allowedDaysRaw === 'string' ? JSON.parse(allowedDaysRaw) : []);

            while (safetyCounter < 30) {
                 const currentDayOfWeek = targetDate.getDay(); // 0 = Sun
                 // Only check allowed days if the array is not empty (empty implies allowed or legacy data)
                 if (allowedDays.length === 0 || allowedDays.includes(currentDayOfWeek)) {
                     break; 
                 }
                 targetDate.setDate(targetDate.getDate() + 1);
                 safetyCounter++;
            }

            if (targetDate > today) continue;
            
            const targetDateStr = targetDate.toISOString().split('T')[0];
            
            // Check existence in REQUESTS (Legacy check, primarily relies on maintenance_logs now but kept for idempotency)
            const [existing] = await pool.query(
                'SELECT id FROM requests WHERE maintenance_id = ? AND planned_resolution_date = ?',
                [template.id, targetDateStr]
            );

            if (existing.length > 0) {
                // Update maintenance record to move window forward if stuck
                if (!template.last_generated_at || new Date(template.last_generated_at) < targetDate) {
                     await pool.execute('UPDATE maintenances SET last_generated_at = ? WHERE id = ?', [targetDateStr, template.id]);
                }
                continue;
            }

            // --- NEW LOGGING LOGIC ---
            
            console.log(`[MAINT] Processing template ${template.title} for ${targetDateStr}`);
            const logId = crypto.randomUUID();
            
            // 1. Create Log Entry (Pending)
            await pool.execute(
                `INSERT INTO maintenance_logs (id, maintenance_id, status, template_snapshot, created_at) 
                 VALUES (?, ?, 'pending', ?, ?)`,
                [logId, template.id, JSON.stringify(template), targetDateStr] // using targetDateStr as created_at reference for the "plan"
            );

            // 2. Try Create Request
            try {
                // Safe parsing of responsible_person_ids
                const responsibleIdsRaw = template.responsible_person_ids;
                const responsibleIds = Array.isArray(responsibleIdsRaw) 
                    ? responsibleIdsRaw 
                    : (typeof responsibleIdsRaw === 'string' ? JSON.parse(responsibleIdsRaw) : []);

                const solverId = responsibleIds.length > 0 ? responsibleIds[0] : null;
                const state = solverId ? 'assigned' : 'new';
                const authorId = 'system'; 
                const requestId = crypto.randomUUID(); // GENERATE ID MANUALLY

                // INSERT query MUST include 'id'
                await pool.execute(
                    `INSERT INTO requests (id, tech_id, maintenance_id, title, author_id, solver_id, description, priority, state, planned_resolution_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'priority', ?, ?)`,
                    [requestId, template.tech_id, template.id, template.title, authorId, solverId, template.description, state, targetDateStr]
                );

                // 3. Success: Update Log & Maintenance
                await pool.execute(
                    `UPDATE maintenance_logs SET status = 'success', executed_at = NOW(), request_id = ? WHERE id = ?`,
                    [requestId, logId]
                );
                await pool.execute('UPDATE maintenances SET last_generated_at = ? WHERE id = ?', [targetDateStr, template.id]);

                // 4. Send Email (Real Recipients with Localization)
                // Determine recipients map: Email -> Language
                const recipients = new Map(); // email -> language

                if (solverId) {
                    // Send to assigned responsible person
                    const [users] = await pool.query('SELECT email, language FROM users WHERE id = ?', [solverId]);
                    if (users.length > 0 && users[0].email) {
                        recipients.set(users[0].email, users[0].language || 'cs');
                    }
                } else {
                    // No responsible person set -> Send to ALL maintenance staff
                    const [maintUsers] = await pool.query("SELECT email, language FROM users WHERE role = 'maintenance' AND isBlocked = 0");
                    maintUsers.forEach(u => {
                        if (u.email) recipients.set(u.email, u.language || 'cs');
                    });
                }

                // Insert into queue PER USER (because of translation)
                for (const [email, lang] of recipients.entries()) {
                    const emailData = {
                        title: template.title,
                        description: template.description,
                        techName: template.tech_name,
                        date: targetDateStr
                    };
                    
                    const { subject, body } = getMaintenanceEmail(lang, emailData);

                    await pool.execute(
                        'INSERT INTO email_queue (to_address, subject, body) VALUES (?, ?, ?)',
                        [email, subject, body]
                    );
                }

            } catch (createErr) {
                // 5. Error: Update Log
                console.error(`[MAINT] Failed to create request for template ${template.id}`, createErr);
                await pool.execute(
                    `UPDATE maintenance_logs SET status = 'error', executed_at = NOW(), error_message = ? WHERE id = ?`,
                    [createErr.message, logId]
                );
            }
        }

    } catch (err) {
        console.error('[MAINT] Error generating requests:', err);
    }
}

// --- Scheduler Function ---
export const startWorker = () => {
    console.log('--- Worker Background Process Started ---');
    console.log('Jobs: Email (60s), Maintenance Generator (60s), Overdue Checker (Daily 00:01)');

    // Initial Run on Startup
    processEmailQueue();
    generateMaintenanceRequests();

    let lastOverdueCheck = null;

    setInterval(() => {
        const now = new Date();
        
        // Regular jobs (every minute)
        processEmailQueue();
        generateMaintenanceRequests();

        // Daily Job at 00:01
        const currentDay = now.getDate();
        if (now.getHours() === 0 && now.getMinutes() === 1) {
            if (lastOverdueCheck !== currentDay) {
                checkDailyOverdue();
                lastOverdueCheck = currentDay;
            }
        }

    }, 60000); // 60s Interval
};
