
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Request, User, Technology, Supplier } from './types';
import { db } from './db';

// Helper to load fonts for diacritics support
const loadFonts = async (doc: jsPDF) => {
    const fontBaseUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/";
    
    const loadFont = async (filename: string, fontName: string, style: string) => {
        try {
            const response = await fetch(`${fontBaseUrl}${filename}`);
            if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
            const buffer = await response.arrayBuffer();
            const binary = new Uint8Array(buffer);
            let binaryString = "";
            for (let i = 0; i < binary.byteLength; i++) {
                binaryString += String.fromCharCode(binary[i]);
            }
            const base64 = window.btoa(binaryString);
            
            doc.addFileToVFS(filename, base64);
            doc.addFont(filename, fontName, style);
        } catch (e) {
            console.warn(`Failed to load font ${fontName}. Diacritics may not render correctly.`, e);
        }
    };

    await Promise.all([
        loadFont("Roboto-Regular.ttf", "Roboto", "normal"),
        loadFont("Roboto-Medium.ttf", "Roboto", "bold")
    ]);
};

const formatTimeHHMM = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')} h`;
};

const formatCurrency = (amount: number | undefined) => {
    return `${amount || 0} EUR`;
};

const formatDateCZ = (isoDate: string | undefined) => {
    if (!isoDate) return '-';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
};

const getPrioWeight = (p: string) => {
    if (p === 'urgent') return 3;
    if (p === 'priority') return 2;
    return 1;
};

export const generateWorkListPDF = async (
    requests: Request[], 
    user: User, 
    title: string, 
    t: (key: string) => string, 
    lang: string
) => {
    const doc = new jsPDF({ orientation: 'landscape' }); // Landscape for better column fit
    
    // Load fonts
    await loadFonts(doc);
    doc.setFont("Roboto"); // Activate the font

    const techs = db.technologies.list();
    const suppliers = db.suppliers.list();
    const users = db.users.list();

    // --- Header ---
    doc.setFontSize(18);
    doc.setFont("Roboto", "bold");
    doc.text("FHB Maintain - List pracnosti", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("Roboto", "normal");
    doc.setTextColor(100);
    
    const dateStr = new Date().toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US'); 
    doc.text(`${t('common.date')}: ${dateStr}`, 14, 28);
    doc.text(`${t('role.maintenance')}: ${user.name}`, 14, 33);
    doc.text(`${t('common.filter')}: ${title}`, 14, 38);

    // --- Sorting Logic ---
    // 1. Priority (Urgent > Priority > Basic)
    // 2. Machine Name (Alphabetical)
    const sortedRequests = [...requests].sort((a, b) => {
        // Priority Sort
        const weightA = getPrioWeight(a.priority);
        const weightB = getPrioWeight(b.priority);
        if (weightA !== weightB) return weightB - weightA; // Descending weight

        // Tech Name Sort
        const techA = techs.find(t => t.id === a.techId)?.name || '';
        const techB = techs.find(t => t.id === b.techId)?.name || '';
        return techA.localeCompare(techB);
    });

    // --- Sort & Group (Internal vs External) ---
    // Note: We maintain the sort order determined above within the groups
    const internalRequests: Request[] = [];
    const externalRequests: Request[] = [];

    sortedRequests.forEach(r => {
        const isInternal = r.assignedSupplierId === 'internal' || !r.assignedSupplierId;
        if (isInternal) {
            internalRequests.push(r);
        } else {
            externalRequests.push(r);
        }
    });

    // Helper to generate Row Data
    const generateRow = (r: Request) => {
        const tech = techs.find(t => t.id === r.techId);
        const supplier = r.assignedSupplierId && r.assignedSupplierId !== 'internal' 
            ? suppliers.find(s => s.id === r.assignedSupplierId)?.name 
            : 'Interní';
        
        const solverName = r.solverId ? users.find(u => u.id === r.solverId)?.name || '-' : '-';
        const localizedPrio = t(`prio.${r.priority}`);
        const estTime = r.estimatedTime ? formatTimeHHMM(r.estimatedTime) : '-';
        const cost = formatCurrency(r.estimatedCost);
        const plannedDate = formatDateCZ(r.plannedResolutionDate);

        return [
            { content: r.title, styles: { fontStyle: 'bold' } },
            tech?.name + (tech?.serialNumber ? `\n(S.N.: ${tech.serialNumber})` : ''),
            { content: r.description, styles: { cellWidth: 60 } }, 
            solverName,
            plannedDate,
            localizedPrio,
            estTime,
            cost,
            supplier
        ];
    };

    const tableBody: any[] = [];

    // Add Internal Requests
    internalRequests.forEach(r => tableBody.push(generateRow(r)));

    // Add Separator & External Requests if any
    if (externalRequests.length > 0) {
        if (internalRequests.length > 0) {
            // Add Separator Row
            tableBody.push([{ 
                content: 'EXTERNÍ DODAVATELÉ', 
                colSpan: 9, 
                styles: { fillColor: [220, 220, 220], textColor: [50, 50, 50], fontStyle: 'bold', halign: 'center', minCellHeight: 8 } 
            }]);
        }
        externalRequests.forEach(r => tableBody.push(generateRow(r)));
    }

    // --- Main Table ---
    // Columns: Title, Tech, Desc, Solver, Date, Priority, Time, Cost, Solution
    const columns = [
        t('form.title'), 
        'Technologie', 
        t('form.description'), 
        'Řešitel', 
        'Termín',
        'Priorita', 
        'Čas', 
        'Cena',
        'Řešení'
    ];

    autoTable(doc, {
        startY: 45,
        head: [columns],
        body: tableBody,
        styles: {
            font: "Roboto",
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [66, 66, 66],
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            2: { cellWidth: 70 }, // Description wider
            4: { cellWidth: 20 }, // Date
            6: { cellWidth: 15 }, // Time
            7: { cellWidth: 20 }, // Cost
        }
    });

    // --- Summary Section ---
    const calculateTotals = (reqs: Request[]) => {
        return {
            count: reqs.length,
            time: reqs.reduce((sum, r) => sum + (r.estimatedTime || 0), 0),
            cost: reqs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0)
        };
    };

    const internalTotals = calculateTotals(internalRequests);
    const externalTotals = calculateTotals(externalRequests);
    const totalCount = internalTotals.count + externalTotals.count;
    const totalTime = internalTotals.time + externalTotals.time;
    const totalCost = internalTotals.cost + externalTotals.cost;

    const summaryY = (doc as any).lastAutoTable.finalY + 10;

    // Check if summary fits on page, else add page
    if (summaryY > 180) { // Landscape height is approx 210
        doc.addPage();
        (doc as any).lastAutoTable.finalY = 20;
    }

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Souhrn', 'Počet', 'Celkový čas', 'Celková cena']],
        body: [
            ['Interní požadavky', internalTotals.count, formatTimeHHMM(internalTotals.time), formatCurrency(internalTotals.cost)],
            ['Externí dodavatelé', externalTotals.count, formatTimeHHMM(externalTotals.time), formatCurrency(externalTotals.cost)],
            [
                { content: 'CELKEM', styles: { fontStyle: 'bold' } }, 
                { content: totalCount, styles: { fontStyle: 'bold' } }, 
                { content: formatTimeHHMM(totalTime), styles: { fontStyle: 'bold' } },
                { content: formatCurrency(totalCost), styles: { fontStyle: 'bold' } }
            ]
        ],
        theme: 'plain',
        styles: {
            font: "Roboto",
            fontSize: 10
        },
        headStyles: {
            fontStyle: 'bold'
        },
        tableWidth: 'wrap',
        margin: { left: 14 }
    });

    // Generate filename with date
    const safeName = user.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateFilename = new Date().toISOString().slice(0,10);
    doc.save(`worklist_${safeName}_${dateFilename}.pdf`);
};
