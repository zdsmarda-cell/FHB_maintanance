
import pool from '../db.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { sendPushToUser } from '../push.js';

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
        open_app: "Otevřít aplikaci",
        generated: "Vygenerováno",
        push_msg_prefix: "Počet požadavků po termínu: "
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
        open_app: "Open Application",
        generated: "Generated",
        push_msg_prefix: "Overdue requests count: "
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
        open_app: "Відкрити додаток",
        generated: "Згенеровано",
        push_msg_prefix: "Кількість прострочених запитів: "
    }
};

const getStrings = (lang) => i18n[lang] || i18n['cs'];

// Helper to parse localized string
const getLocalized = (data, lang) => {
    if (!data) return '';
    try {
        if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            const parsed = JSON.parse(data);
            return parsed[lang] || parsed['cs'] || parsed['en'] || Object.values(parsed)[0] || data;
        }
        return data;
    } catch (e) {
        return data;
    }
};

// Helper to load font for PDF generation in Node environment
const loadPdfFont = async (doc) => {
    try {
        // We use Roboto because standard PDF fonts do not support UTF-8 (CZ/UK chars)
        const response = await fetch("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf");
        if (!response.ok) throw new Error("Failed to fetch font");
        
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        
        doc.addFileToVFS("Roboto-Regular.ttf", base64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.setFont("Roboto");
    } catch (e) {
        console.warn("[WORKER] Failed to load font for PDF, diacritics may not render correctly:", e.message);
    }
};

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

// Generate valid PDF Buffer using jsPDF
const generatePdfAttachment = async (myAssigned, myUnassigned, user, s, dateStr) => {
    const doc = new jsPDF();
    
    // Load font for Czech/Ukrainian characters
    await loadPdfFont(doc);

    // Header
    doc.setFontSize(18);
    doc.text(s.report_title, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${s.generated}: ${dateStr}`, 14, 28);
    doc.text(`User: ${user.name}`, 14, 33);

    let finalY = 40;

    // Helper for table body
    const mapRows = (rows) => rows.map(r => [
        new Date(r.planned_resolution_date).toLocaleDateString(s === i18n['en'] ? 'en-US' : 'cs-CZ'),
        r.tech_name || '-',
        r.title || '-', // Title is already localized in the caller
        r.priority
    ]);

    // Table 1: Assigned
    if (myAssigned.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(s.my_assigned, 14, finalY);
        
        doc.autoTable({
            startY: finalY + 5,
            head: [[s.date, s.tech, s.req_title, s.prio]],
            body: mapRows(myAssigned),
            styles: { font: "Roboto", fontSize: 10 },
            headStyles: { fillColor: [66, 66, 66] }
        });
        finalY = doc.lastAutoTable.finalY + 15;
    }

    // Table 2: Unassigned
    if (myUnassigned.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(s.unassigned, 14, finalY);
        
        doc.autoTable({
            startY: finalY + 5,
            head: [[s.date, s.tech, s.req_title, s.prio]],
            body: mapRows(myUnassigned),
            styles: { font: "Roboto", fontSize: 10 },
            headStyles: { fillColor: [220, 53, 69] } // Red header for urgent/unassigned
        });
    }

    // Return as Base64 string
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer).toString('base64');
};

export const checkDailyOverdue = async () => {
    console.log('[WORKER] Starting Daily Overdue Check...');
    try {
        // 1. Fetch Overdue Requests
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const today = `${y}-${m}-${d}`;
        
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

        // 2. Fetch Users
        const [users] = await pool.query(`
            SELECT id, name, email, role, language, assignedLocationIds, assignedWorkplaceIds 
            FROM users 
            WHERE role IN ('admin', 'maintenance') AND isBlocked = 0
        `);

        // 3. Process Per User
        for (const user of users) {
            const lang = user.language || 'cs';
            const s = getStrings(lang);

            const localizeReq = (r) => ({
                ...r,
                title: getLocalized(r.title, lang),
                tech_name: getLocalized(r.tech_name, lang)
            });

            const myAssigned = overdueRequests
                .filter(r => r.solver_id === user.id)
                .map(localizeReq);

            const myUnassigned = overdueRequests
                .filter(r => {
                    if (r.solver_id) return false; 
                    if (user.role === 'admin') return true; 

                    const locs = typeof user.assignedLocationIds === 'string' ? JSON.parse(user.assignedLocationIds) : (user.assignedLocationIds || []);
                    const wps = typeof user.assignedWorkplaceIds === 'string' ? JSON.parse(user.assignedWorkplaceIds) : (user.assignedWorkplaceIds || []);

                    return locs.includes(r.loc_id) || wps.includes(r.wp_id);
                })
                .map(localizeReq);

            const totalCount = myAssigned.length + myUnassigned.length;

            if (totalCount > 0) {
                
                // Email Body
                let emailBody = `<h2>${s.title}</h2>`;
                emailBody += `<p>${s.greeting} <strong>${user.name}</strong>, ${s.intro}</p>`;
                
                if (myAssigned.length > 0) emailBody += generateHtmlTable(myAssigned, s.my_assigned, s);
                if (myUnassigned.length > 0) emailBody += generateHtmlTable(myUnassigned, s.unassigned, s);

                emailBody += `<p style="margin-top:20px"><a href="${APP_URL}">${s.open_app}</a></p>`;

                // PDF
                const base64Content = await generatePdfAttachment(myAssigned, myUnassigned, user, s, today);
                const attachments = JSON.stringify([
                    {
                        filename: `report_overdue_${today}.pdf`,
                        content: base64Content,
                        encoding: 'base64'
                    }
                ]);

                // Email Queue
                await pool.execute(
                    'INSERT INTO email_queue (to_address, subject, body, attachments) VALUES (?, ?, ?, ?)',
                    [user.email, `FHB maintain - ${s.title}`, emailBody, attachments]
                );
                
                // PUSH Notification Trigger with count
                sendPushToUser(user.id, {
                    title: s.title,
                    body: `${s.push_msg_prefix} ${totalCount}`,
                    url: '/requests'
                });
                
                console.log(`[WORKER] Queued overdue PDF report & Push for ${user.email} (Count: ${totalCount})`);
            }
        }

    } catch (err) {
        console.error('[WORKER] Error in daily overdue check:', err);
    }
};
