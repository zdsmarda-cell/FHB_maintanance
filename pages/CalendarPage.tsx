
import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { User, Request } from '../lib/types';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, User as UserIcon, Truck, Wrench, Printer } from 'lucide-react';
import { generateWorkListPDF } from '../lib/pdf';

interface CalendarPageProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

interface DayData {
    internalCount: number;
    internalEffort: number;
    externalCount: number;
    externalEffort: number;
}

export const CalendarPage = ({ user, onNavigate }: CalendarPageProps) => {
    const { t, lang } = useI18n(); // Destructure lang
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Admin selector state
    const [selectedSolverId, setSelectedSolverId] = useState(user.id);
    const [solverRequests, setSolverRequests] = useState<Request[]>([]);

    // Load requests whenever user changes or component mounts (ensures fresh data)
    useEffect(() => {
        const loadData = () => {
            const allRequests = db.requests.list();
            const filtered = allRequests.filter(r => {
                if (r.solverId !== selectedSolverId) return false;
                if (r.state === 'solved' || r.state === 'cancelled') return false;
                // REMOVED 'internal' only filter to show both
                if (!r.plannedResolutionDate) return false;
                return true;
            });
            setSolverRequests(filtered);
        };
        loadData();
    }, [selectedSolverId]);

    const nextMonth = () => {
        const next = new Date(currentDate);
        next.setMonth(currentDate.getMonth() + 1);
        setCurrentDate(next);
    }

    const prevMonth = () => {
        const prev = new Date(currentDate);
        prev.setMonth(currentDate.getMonth() - 1);
        setCurrentDate(prev);
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    // Group by Date & Type
    const requestsByDate: Record<string, DayData> = {};
    const techs = db.technologies.list();

    solverRequests.forEach(r => {
        const d = r.plannedResolutionDate!;
        if (!requestsByDate[d]) {
            requestsByDate[d] = { internalCount: 0, internalEffort: 0, externalCount: 0, externalEffort: 0 };
        }

        // Logic to determine if Internal or External
        const tech = techs.find(t => t.id === r.techId);
        const isInternal = r.assignedSupplierId === 'internal' || (!r.assignedSupplierId && !tech?.supplierId);

        if (isInternal) {
            requestsByDate[d].internalCount++;
            requestsByDate[d].internalEffort += (r.estimatedTime || 0);
        } else {
            requestsByDate[d].externalCount++;
            requestsByDate[d].externalEffort += (r.estimatedTime || 0);
        }
    });

    // Calendar Generation
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Mon, 6=Sun)
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getFirstDayOfMonth(year, month); // 0-6

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    const monthNames = [
        "Leden", "Únor", "Březen", "Duben", "Květen", "Červen", 
        "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"
    ];

    const handleDayClick = (dateStr: string, type: 'internal' | 'external') => {
        onNavigate('requests', {
            solverId: selectedSolverId,
            date: dateStr,
            supplierId: type // 'internal' or 'external'
        });
    };

    // PDF Export
    const handleExportDay = async (e: React.MouseEvent, dateStr: string) => {
        e.stopPropagation();
        const dailyRequests = solverRequests.filter(r => r.plannedResolutionDate === dateStr);
        // Construct a User object to pass to PDF generator
        const userObj = db.users.list().find(u => u.id === selectedSolverId) || user;
        
        await generateWorkListPDF(dailyRequests, userObj, `Denní plán: ${dateStr}`, t, lang);
    };

    // Prepare User Options for Admin
    const maintenanceUsers = db.users.list().filter(u => !u.isBlocked && (u.role === 'maintenance' || u.role === 'admin'));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded shadow-sm border border-slate-200">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-slate-800">
                        Kalendář pracnosti - {monthNames[month]} {year}
                    </h2>
                    
                    {/* Admin User Selector */}
                    {user.role === 'admin' && (
                        <div className="flex items-center gap-2 text-sm">
                            <UserIcon className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-500">Zobrazit pro:</span>
                            <select 
                                className="border rounded p-1 text-slate-800 font-medium bg-slate-50"
                                value={selectedSolverId}
                                onChange={(e) => setSelectedSolverId(e.target.value)}
                            >
                                {maintenanceUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded border"><ChevronLeft className="w-5 h-5"/></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 text-sm hover:bg-slate-100 rounded border">Dnes</button>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded border"><ChevronRight className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-7 bg-slate-50 border-b text-center py-2 text-sm font-semibold text-slate-600">
                    <div>Po</div><div>Út</div><div>St</div><div>Čt</div><div>Pá</div><div>So</div><div>Ne</div>
                </div>
                
                {/* Grid */}
                <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 gap-px border-b border-slate-200">
                    {/* Empty cells */}
                    {Array.from({ length: startDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-white min-h-[120px] p-2" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        const data = requestsByDate[dateStr];
                        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

                        return (
                            <div 
                                key={day} 
                                className={`bg-white min-h-[120px] p-2 flex flex-col hover:bg-blue-50/20 transition-colors group relative ${isToday ? 'bg-blue-50/50' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                                        {day}
                                    </span>
                                    {/* Daily PDF Export Button - Visible on hover if there is data */}
                                    {data && (data.internalCount > 0 || data.externalCount > 0) && (
                                        <button 
                                            onClick={(e) => handleExportDay(e, dateStr)} 
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                                            title="Tisk denního plánu"
                                        >
                                            <Printer className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                {data && (
                                    <div className="mt-auto space-y-1">
                                        {/* Internal Block */}
                                        {(data.internalCount > 0) && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); handleDayClick(dateStr, 'internal'); }}
                                                className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors"
                                                title="Interní úkoly"
                                            >
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="font-bold flex items-center"><Wrench className="w-3 h-3 mr-1"/> {data.internalCount}</span>
                                                    {data.internalEffort > 0 && <span className="font-mono">{formatTime(data.internalEffort)}</span>}
                                                </div>
                                            </div>
                                        )}

                                        {/* External Block */}
                                        {(data.externalCount > 0) && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); handleDayClick(dateStr, 'external'); }}
                                                className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded border border-amber-200 cursor-pointer hover:bg-amber-200 transition-colors"
                                                title="Externí úkoly"
                                            >
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="font-bold flex items-center"><Truck className="w-3 h-3 mr-1"/> {data.externalCount}</span>
                                                    {data.externalEffort > 0 && <span className="font-mono">{formatTime(data.externalEffort)}</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* Fill remaining cells if needed to make it look square, logic omitted for brevity */}
                </div>
            </div>
            
            <div className="text-xs text-slate-500 p-2 flex gap-4">
                <span>* Zobrazují se aktivní úkoly pro vybraného uživatele.</span>
                <span className="flex items-center"><div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded mr-1"></div> Interní</span>
                <span className="flex items-center"><div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded mr-1"></div> Externí</span>
            </div>
        </div>
    );
};
