
// Localization Dictionary for Emails
const i18n = {
    cs: {
        new_maintenance: "Nová údržba",
        new_request: "Nový požadavek",
        desc: "Popis",
        priority: "Priorita",
        auto_generated: "Automaticky vygenerováno",
        details: "Detaily požadavku",
        date: "Termín",
        title: "Název",
        tech: "Technologie",
        link_text: "Otevřít v aplikaci",
        reset_pass_subject: "Obnova hesla - FHB Maintain",
        reset_pass_body: "Dobrý den,<br/><br/>požádali jste o obnovu hesla. Klikněte na následující odkaz pro nastavení nového hesla:",
        reset_pass_link_validity: "Odkaz je platný 1 hodinu.",
        created_at: "Vytvořeno",
        photo_attached: "Fotografie přiložena v aplikaci"
    },
    en: {
        new_maintenance: "New Maintenance",
        new_request: "New Request",
        desc: "Description",
        priority: "Priority",
        auto_generated: "Automatically generated",
        details: "Request Details",
        date: "Due Date",
        title: "Title",
        tech: "Technology",
        link_text: "Open in App",
        reset_pass_subject: "Password Reset - FHB Maintain",
        reset_pass_body: "Hello,<br/><br/>you requested a password reset. Click the link below to set a new password:",
        reset_pass_link_validity: "The link is valid for 1 hour.",
        created_at: "Created At",
        photo_attached: "Photo attached in app"
    },
    uk: {
        new_maintenance: "Нове технічне обслуговування",
        new_request: "Новий запит",
        desc: "Опис",
        priority: "Пріоритет",
        auto_generated: "Автоматично згенеровано",
        details: "Деталі запиту",
        date: "Термін",
        title: "Назва",
        tech: "Технологія",
        link_text: "Відкрити в додатку",
        reset_pass_subject: "Скидання пароля - FHB Maintain",
        reset_pass_body: "Вітаємо,<br/><br/>ви подали запит на скидання пароля. Натисніть посилання нижче, щоб встановити новий пароль:",
        reset_pass_link_validity: "Посилання дійсне протягом 1 години.",
        created_at: "Створено",
        photo_attached: "Фото прикріплено в додатку"
    }
};

const getStrings = (lang) => i18n[lang] || i18n['cs'];

const APP_URL = process.env.APP_URL || 'https://fhbmain.impossible.cz';

// Helper to parse localized string (JSON) safely server-side
const getLocalized = (data, lang) => {
    if (!data) return '';
    try {
        // Check if it looks like JSON
        if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            const parsed = JSON.parse(data);
            return parsed[lang] || parsed['cs'] || parsed['en'] || Object.values(parsed)[0] || data;
        }
        return data; // Return as is if not JSON
    } catch (e) {
        return data;
    }
};

// Standard New Request Email - HTML Table Version
export const getNewRequestEmailBody = (lang = 'cs', data) => {
    const s = getStrings(lang);
    
    // Parse localized title and description to avoid {"cs":...} in subject/body
    const title = getLocalized(data.title, lang);
    const description = getLocalized(data.description, lang);
    const priority = data.priority || 'Basic';
    const createdDate = new Date().toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');

    let imgHtml = '';
    if (data.photoUrl) {
        let src = data.photoUrl;
        if (src.startsWith('/')) {
            src = `${APP_URL}${src}`;
        }
        imgHtml = `
            <div style="margin-top: 15px; border: 1px solid #ddd; padding: 5px; display: inline-block;">
                <img src="${src}" alt="Preview" style="max-width: 200px; max-height: 200px;" />
            </div>
        `;
    }

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #2563eb; margin-top: 0;">FHB Maintein</h2>
        <h3 style="color: #333;">${s.new_request}: ${title}</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <tr style="background-color: #f8fafc;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; width: 30%;">${s.created_at}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${createdDate}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.priority}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-transform: uppercase;">${priority}</td>
            </tr>
            ${data.techName ? `
            <tr style="background-color: #f8fafc;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.tech}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.techName}</td>
            </tr>
            ` : ''}
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.desc}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${description}</td>
            </tr>
        </table>

        ${imgHtml}

        <div style="margin-top: 25px; text-align: center;">
            <a href="${APP_URL}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                ${s.link_text}
            </a>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">FHB Maintein System</p>
    </div>
    `;

    return {
        subject: `FHB main - ${s.new_request} - ${title}`,
        // Send raw HTML string (DB handles UTF-8)
        body: html
    };
};

// Rich HTML Email for Maintenance
export const getMaintenanceEmail = (lang, data) => {
    const s = getStrings(lang);
    
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">${s.new_maintenance}: ${data.title}</h2>
        <p style="color: #666;">${s.auto_generated}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="background-color: #f8fafc;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.tech}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.techName || '-'}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.date}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.date}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.desc}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.description}</td>
            </tr>
        </table>

        <div style="margin-top: 25px; text-align: center;">
            <a href="${APP_URL}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${s.link_text}
            </a>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">FHB Maintein System</p>
    </div>
    `;

    return {
        subject: `FHB main - ${s.new_maintenance}: ${data.title}`,
        // Send raw HTML string
        body: html
    };
};

export const getPasswordResetEmail = (lang, link) => {
    const s = getStrings(lang);
    const html = `${s.reset_pass_body}<br/><br/><a href="${link}">${link}</a><br/><br/>${s.reset_pass_link_validity}`;
    
    return {
        subject: s.reset_pass_subject,
        body: html // Send raw HTML string
    };
};
