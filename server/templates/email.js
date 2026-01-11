
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
        reset_pass_link_validity: "Odkaz je platný 1 hodinu."
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
        reset_pass_link_validity: "The link is valid for 1 hour."
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
        reset_pass_link_validity: "Посилання дійсне протягом 1 години."
    }
};

const getStrings = (lang) => i18n[lang] || i18n['cs'];

const APP_URL = process.env.APP_URL || 'https://fhbmain.impossible.cz';

// Standard New Request Email (Legacy support + Localized)
export const getNewRequestEmailBody = (priority, description, lang = 'cs') => {
    const s = getStrings(lang);
    return `${s.new_request}: ${priority}\n${s.desc}: ${description}`;
};

// Rich HTML Email for Maintenance
export const getMaintenanceEmail = (lang, data) => {
    const s = getStrings(lang);
    
    // Construct HTML Table
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
        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">FHB Maintain System</p>
    </div>
    `;

    return {
        subject: `FHB main - ${s.new_maintenance}: ${data.title}`,
        body: html
    };
};

export const getPasswordResetEmail = (lang, link) => {
    const s = getStrings(lang);
    return {
        subject: s.reset_pass_subject,
        body: `${s.reset_pass_body}<br/><br/><a href="${link}">${link}</a><br/><br/>${s.reset_pass_link_validity}`
    };
};
