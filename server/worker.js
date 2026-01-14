
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

// Helper to format Date to YYYY-MM-DD using LOCAL time values to avoid UTC shift issues at 00:01
const toLocalSqlDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const processEmailQueue = async () => {
  try {
    const [rows] = await pool.query('SELECT * FROM email_queue WHERE sent_at IS NULL AND attempts < 3 LIMIT 10');
    
    if (rows.length === 0) return;

    console.log(`[MAILER] Found ${rows.length} emails to send.`);

    for (const email of rows) {
      try {
        console.log(`[MAILER] Sending to ${email.to_address}: ${email.subject}`);
        
        let bodyToSend = email.body;
        
        // Check for Legacy Base64
        if (bodyToSend && !bodyToSend.includes(' ') && !bodyToSend.trim().startsWith('<')) {
            try {
                const decoded = Buffer.from(bodyToSend, 'base64').toString('utf-8');
                if (decoded.includes('<') || decoded.includes(' ')) {
                    bodyToSend = decoded;
                }
            } catch (e) { }
        }

        const mailOptions = {
          from: process.env.EMAIL_FROM || '"FHB Maintain" <noreply@fhb.sk>',
          to: email.to_address,
          subject: email.subject,
          html: bodyToSend,
          attachments: []
        };

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
            // Determine the base date (Last Generated OR Created At)
            const lastGenerated = template.last_generated_at ? new Date(template.last_generated_at) : new Date(template.created_at);
            lastGenerated.setHours(0,0,0,0);

            // 1. Calculate Theoretical Next Date
            let targetDate = new Date(lastGenerated);
            targetDate.setDate(lastGenerated.getDate() + template.interval_days);

            // 2. Catch-up Logic:
            // If the calculated target date is in the past (e.g. worker didn't run yesterday),
            // do NOT generate a request for yesterday. Move the target to TODAY.
            if (targetDate < today) {
                console.log(`[MAINT] Template "${template.title}" is overdue (Target was ${toLocalSqlDate(targetDate)}). Fast-forwarding to Today.`);
                targetDate = new Date(today);
            }

            // 3. Allowed Days Logic (Skip weekends/specific days)
            let safetyCounter = 0;
            const allowedDaysRaw = template.allowed_days;
            const allowedDays = Array.isArray(allowedDaysRaw) 
                ? allowedDaysRaw 
                : (typeof allowedDaysRaw === 'string' ? JSON.parse(allowedDaysRaw) : []);

            // If allowedDays is specified, advance targetDate until it lands on an allowed day
            if (allowedDays.length > 0) {
                while (safetyCounter < 60) { // Max check to prevent infinite loop
                     const currentDayOfWeek = targetDate.getDay(); // 0 = Sun
                     if (allowedDays.includes(currentDayOfWeek)) {
                         break; // Valid day found
                     }
                     targetDate.setDate(targetDate.getDate() + 1); // Move to next day
                     safetyCounter++;
                }
            }

            // 4. Future Check:
            // If after adjustments the date is in the future, wait.
            // Note: If targetDate === today, we PROCEED.
            if (targetDate > today) continue;
            
            // Format for SQL (YYYY-MM-DD) using LOCAL time values
            const targetDateStr = toLocalSqlDate(targetDate);
            
            // 5. Idempotency Check:
            // Check if we already created a request for this maintenance ID on this specific Target Date
            // This prevents duplicate generation if the worker runs multiple times a day
            const [existing] = await pool.query(
                'SELECT id FROM requests WHERE maintenance_id = ? AND planned_resolution_date = ?',
                [template.id, targetDateStr]
            );

            if (existing.length > 0) {
                // Self-Healing: If DB thinks last_generated is old, but a request EXISTS for today, update the pointer.
                if (!template.last_generated_at || new Date(template.last_generated_at) < targetDate) {
                     console.log(`[MAINT] Correcting last_generated_at pointer for "${template.title}" to ${targetDateStr}`);
                     await pool.execute('UPDATE maintenances SET last_generated_at = ? WHERE id = ?', [targetDateStr, template.id]);
                }
                continue; // Skip generation
            }

            // --- GENERATION EXECUTION ---
            
            console.log(`[MAINT] Generating request for "${template.title}" due on ${targetDateStr}`);
            const logId = crypto.randomUUID();
            
            // Log Start
            await pool.execute(
                `INSERT INTO maintenance_logs (id, maintenance_id, status, template_snapshot, created_at) 
                 VALUES (?, ?, 'pending', ?, ?)`,
                [logId, template.id, JSON.stringify(template), targetDateStr]
            );

            try {
                const responsibleIdsRaw = template.responsible_person_ids;
                const responsibleIds = Array.isArray(responsibleIdsRaw) 
                    ? responsibleIdsRaw 
                    : (typeof responsibleIdsRaw === 'string' ? JSON.parse(responsibleIdsRaw) : []);

                const solverId = responsibleIds.length > 0 ? responsibleIds[0] : null;
                const state = solverId ? 'assigned' : 'new';
                const authorId = 'system'; 
                const requestId = crypto.randomUUID();

                // Create Request
                // Note: The planned_resolution_date corresponds to targetDateStr which is usually TODAY
                await pool.execute(
                    `INSERT INTO requests (id, tech_id, maintenance_id, title, author_id, solver_id, description, priority, state, planned_resolution_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'priority', ?, ?)`,
                    [requestId, template.tech_id, template.id, template.title, authorId, solverId, template.description, state, targetDateStr]
                );

                // Update Success State
                await pool.execute(
                    `UPDATE maintenance_logs SET status = 'success', executed_at = NOW(), request_id = ? WHERE id = ?`,
                    [requestId, logId]
                );
                
                // IMPORTANT: Move the maintenance pointer to the generated date
                await pool.execute('UPDATE maintenances SET last_generated_at = ? WHERE id = ?', [targetDateStr, template.id]);

                // Send Emails
                const recipients = new Map(); // email -> language

                if (solverId) {
                    const [users] = await pool.query('SELECT email, language FROM users WHERE id = ?', [solverId]);
                    if (users.length > 0 && users[0].email) {
                        recipients.set(users[0].email, users[0].language || 'cs');
                    }
                } else {
                    const [maintUsers] = await pool.query("SELECT email, language FROM users WHERE role = 'maintenance' AND isBlocked = 0");
                    maintUsers.forEach(u => {
                        if (u.email) recipients.set(u.email, u.language || 'cs');
                    });
                }

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
    console.log('Jobs: Email (60s), Maintenance & Overdue (Daily after 00:01)');

    // Initial Run on Startup (Only Email Queue)
    processEmailQueue();
    
    // Track the last date the daily job ran successfully
    // Initialize with null so it runs if we start the server past 00:01 today and it hasn't run yet?
    // BETTER: Initialize with yesterday's date string logic to ensure it runs if started fresh today.
    // However, to prevent double runs on restarts, we ideally need to check DB logs or just rely on runtime memory.
    // For simplicity here: We assume if the server restarts, checking again is safe because the internal functions
    // (generateMaintenanceRequests and checkDailyOverdue) should be idempotent or safe to run multiple times.
    // generateMaintenanceRequests HAS idempotency checks.
    // checkDailyOverdue sends emails - we should verify idempotency there or accept duplicate emails on restart.
    
    let lastDailyRunDate = ''; 

    setInterval(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Use a string representation of the date (YYYY-MM-DD) to track daily execution
        // using local time components
        const todayStr = toLocalSqlDate(now);

        // Regular jobs (every minute)
        processEmailQueue();

        // Daily Jobs Logic:
        // Run if it's past 00:01 AND we haven't run it for this specific date string yet.
        // This handles:
        // 1. Exact 00:01 execution.
        // 2. Skipped minutes (e.g. 00:02).
        // 3. Server restarts later in the day (e.g. 08:00 start will trigger immediate run for "today").
        
        const isTimeForDailyJob = (currentHour > 0) || (currentHour === 0 && currentMinute >= 1);

        if (isTimeForDailyJob && lastDailyRunDate !== todayStr) {
            console.log(`[WORKER] Starting Daily Jobs for date: ${todayStr}`);
            
            // 1. Generate new maintenance requests
            generateMaintenanceRequests();
            
            // 2. Check for overdue requests
            checkDailyOverdue();
            
            // Mark today as done
            lastDailyRunDate = todayStr;
        }

    }, 60000); // 60s Interval
};
