import pool from './db.js';

console.log('Worker started. Checking for emails every 60 seconds...');

const processQueue = async () => {
  try {
    // 1. Fetch unsent emails
    const [rows] = await pool.query('SELECT * FROM email_queue WHERE sent_at IS NULL AND attempts < 3 LIMIT 10');
    
    if (rows.length === 0) return;

    console.log(`Found ${rows.length} emails to send.`);

    for (const email of rows) {
      try {
        // Simulate sending email
        console.log(`[MAILER] Sending to ${email.to_address}: ${email.subject}`);
        
        // 2. Mark as sent
        await pool.execute('UPDATE email_queue SET sent_at = NOW() WHERE id = ?', [email.id]);
      } catch (sendErr) {
        console.error(`Failed to send email ${email.id}`, sendErr);
        await pool.execute('UPDATE email_queue SET attempts = attempts + 1, error = ? WHERE id = ?', [sendErr.message, email.id]);
      }
    }
  } catch (err) {
    console.error('Worker error:', err);
  }
};

// Run immediately then interval
processQueue();
setInterval(processQueue, 60000);
