
import pool from '../db.js';

const APP_URL = process.env.APP_URL || 'https://fhbmain.impossible.cz';

const i18n = {
    cs: {
        title: "Přehled požadavků po termínu",
        greeting: "Vážený uživateli",
        intro: "níže naleznete seznam nevyřešených požadavků, které jsou po termínu.",
        date: "Datum",
        tech: "Stroj",
        req_title: "Název",
        prio: "Priorita",
        my_assigned: "Moje přiřazené požadavky po termínu",
        unassigned: "Nepřiřazené požadavky po termínu (ve vaší působnosti)",
        report_title: "FHB Maintain - Report po termínu",
        open_app: "Otevřít aplikaci"
    },
    en: {
        title: "Overdue Requests Overview",
        greeting: "Dear user",
        intro: "below is a list of unresolved requests that are past their due date.",
        date: "Date",
        tech: "Machine",
        req_title: "Title",
        prio: "Priority",
        my_assigned: "My Overdue Requests",
        unassigned: "Unassigned Overdue Requests (In your scope)",
        report_title: "FHB Maintain - Overdue Report",
        open_app: "Open Application"
    },
    uk: {
        title: "Огляд прострочених запитів",
        greeting: "Шановний користувачу",
        intro: "нижче наведено список невирішених запитів, термін виконання яких минув.",
        date: "Дата",
        tech: "Машина",
        req_title: "Назва",
        prio: "Пріоритет",
        my_assigned: "Мої прострочені запити",
        unassigned: "Непризначені прострочені запити (у вашій компетенції)",
        report_title: "FHB Maintain - Звіт про прострочення",
        open_app: "Відкрити додаток"
    }
};

const getStrings = (lang) => i18n[lang] || i18n['cs'];

const generateHtmlTable = (requests, title, s) => {
    if (requests.length === 0) return '';
    
    let html = `<h3>${title}</h3><table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead><tr style="background-color: #f2f2f2;"><th>${s.date}</th><th>${s.tech}</th><th>${s.req_title}</th><th>${s.prio}</th></tr></thead><tbody>`;
    
    requests.forEach(r => {
        const date = new Date(r.planned_resolution_date).toLocaleDateString(s === i18n['en'] ? 'en-US' : 'cs-CZ');
        html += `<tr>
            <td>${date}</td>
            <td>${r.tech_name || '-'}</td>
            <td>${r.title}</td>
            <td>${r.priority}</td>
        </tr>`;
    });
    
    html += `</tbody></table><br/>`;
    return html;
};

export const checkDailyOverdue = async () => {
    console.log('[WORKER] Starting Daily Overdue Check...');
    try {
        // 1. Fetch Overdue Requests
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch requests that are active AND planned date < today
        // Also join with tech/workplace to determine permissions
        const [overdueRequests] = await pool.query(`
            SELECT 
                r.id, r.title, r.priority, r.planned_resolution_date, r.solver_id,
                t.name as tech_name,
                w.id as wp_id, w.location_id as loc_id
            FROM requests r
            LEFT JOIN technologies t ON r.tech_id = t.id
            LEFT JOIN workplaces w ON t.workplace_id = w.id
            WHERE r.state NOT IN ('solved', 'cancelled')
            AND r.planned_resolution_date < ?
        `, [today]);

        if (overdueRequests.length === 0) {
            console.log('[WORKER] No overdue requests found.');
            return;
        }

        // 2. Fetch Users (Admins and Maintenance) WITH Language
        const [users] = await pool.query(`
            SELECT id, name, email, role, language, assignedLocationIds, assignedWorkplaceIds 
            FROM users 
            WHERE role IN ('admin', 'maintenance') AND isBlocked = 0
        `);

        // 3. Process Per User
        for (const user of users) {
            const lang = user.language || 'cs';
            const s = getStrings(lang);

            // A. Requests assigned directly to this user
            const myAssigned = overdueRequests.filter(r => r.solver_id === user.id);

            // B. Unassigned requests that this user can see
            const myUnassigned = overdueRequests.filter(r => {
                if (r.solver_id) return false; // Already assigned (handled in A or by someone else)
                
                if (user.role === 'admin') return true; // Admin sees all unassigned

                const locs = typeof user.assignedLocationIds === 'string' ? JSON.parse(user.assignedLocationIds) : (user.assignedLocationIds || []);
                const wps = typeof user.assignedWorkplaceIds === 'string' ? JSON.parse(user.assignedWorkplaceIds) : (user.assignedWorkplaceIds || []);

                return locs.includes(r.loc_id) || wps.includes(r.wp_id);
            });

            // If user has relevant info, send email
            if (myAssigned.length > 0 || myUnassigned.length > 0) {
                
                // Construct HTML Body with Link
                let emailBody = `<h2>${s.title}</h2>`;
                emailBody += `<p>${s.greeting} <strong>${user.name}</strong>, ${s.intro}</p>`;
                
                if (myAssigned.length > 0) {
                    emailBody += generateHtmlTable(myAssigned, s.my_assigned, s);
                }
                
                if (myUnassigned.length > 0) {
                    emailBody += generateHtmlTable(myUnassigned, s.unassigned, s);
                }

                emailBody += `<p style="margin-top:20px"><a href="${APP_URL}">${s.open_app}</a></p>`;

                // Generate "PDF" attachment (Mocked as text representation for safety/speed)
                const pdfContent = `
${s.report_title}
${s.date}: ${today}
User: ${user.name}

--- ${s.my_assigned.toUpperCase()} ---
${myAssigned.map(r => `[${r.planned_resolution_date}] ${r.tech_name} - ${r.title}`).join('\n')}

--- ${s.unassigned.toUpperCase()} ---
${myUnassigned.map(r => `[${r.planned_resolution_date}] ${r.tech_name} - ${r.title}`).join('\n')}
                `;
                
                const base64Pdf = Buffer.from(pdfContent).toString('base64');
                const attachments = JSON.stringify([
                    {
                        filename: `report_overdue_${today}.pdf`, // Mocking ext
                        content: base64Pdf,
                        encoding: 'base64'
                    }
                ]);

                // Insert into Email Queue
                await pool.execute(
                    'INSERT INTO email_queue (to_address, subject, body, attachments) VALUES (?, ?, ?, ?)',
                    [user.email, `FHB maintain - ${s.title}`, emailBody, attachments]
                );
                
                console.log(`[WORKER] Queued overdue report for ${user.email} (${lang})`);
            }
        }

    } catch (err) {
        console.error('[WORKER] Error in daily overdue check:', err);
    }
};
