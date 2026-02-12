
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { useI18n } from '../../lib/i18n';
import { Project, Request } from '../../lib/types';
import { Edit, Trash, Plus, Loader, FolderKanban, AlertCircle, CheckCircle, ListChecks } from 'lucide-react';
import { Modal, ConfirmModal, AlertModal } from '../../components/Shared';
import { getLocalized, prepareMultilingual } from '../../lib/helpers';

interface ProjectsPageProps {
    onNavigate: (page: string, params?: any) => void;
}

export const ProjectsPage = ({ onNavigate }: ProjectsPageProps) => {
    const { t, lang } = useI18n();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [requests, setRequests] = useState<Request[]>([]); // Need requests to count stats

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [alertMsg, setAlertMsg] = useState<string | null>(null);

    const [newProject, setNewProject] = useState<Partial<Project>>({
        name: '', description: '', deadline: '', isActive: true
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

    const refresh = async () => {
        setLoading(true);
        try {
            if (isMock) {
                setProjects(db.projects.list());
                setRequests(db.requests.list());
            } else {
                const [projData, reqData] = await Promise.all([
                    api.get('/projects'),
                    api.get('/requests') // Assuming we fetch all requests to count stats
                ]);
                setProjects(projData);
                setRequests(reqData);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    // Stats Calculation
    const getStats = (projectId: string) => {
        const projRequests = requests.filter(r => r.projectId === projectId);
        const total = projRequests.length;
        const unresolved = projRequests.filter(r => r.state !== 'solved' && r.state !== 'cancelled').length;
        
        const today = new Date().toISOString().split('T')[0];
        const overdue = projRequests.filter(r => 
            r.state !== 'solved' && 
            r.state !== 'cancelled' && 
            r.plannedResolutionDate && 
            r.plannedResolutionDate < today
        ).length;

        return { total, unresolved, overdue };
    };

    const handleCreate = async () => {
        if (!newProject.name) {
            setErrors({ name: t('validation.required') });
            return;
        }
        setSaving(true);
        try {
            const payload = { 
                ...newProject, 
                name: await prepareMultilingual(newProject.name || ''),
                description: await prepareMultilingual(newProject.description || '')
            };

            if (isMock) db.projects.add(payload);
            else await api.post('/projects', payload);
            
            setIsCreateOpen(false);
            setNewProject({ name: '', description: '', deadline: '', isActive: true });
            refresh();
        } catch (e) { console.error(e); } 
        finally { setSaving(false); }
    };

    const handleUpdate = async () => {
        if (!editingProject || !editingProject.name) return;
        setSaving(true);
        try {
            const payload = { 
                ...editingProject, 
                name: await prepareMultilingual(editingProject.name),
                description: await prepareMultilingual(editingProject.description || '')
            };

            if (isMock) db.projects.update(editingProject.id, payload);
            else await api.put(`/projects/${editingProject.id}`, payload);
            
            setEditingProject(null);
            refresh();
        } catch (e) { console.error(e); } 
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            if (isMock) db.projects.delete(deleteId);
            else await api.delete(`/projects/${deleteId}`);
            setDeleteId(null);
            refresh();
        } catch (e: any) { 
            console.error(e);
            setDeleteId(null);
            // Check if error is related to foreign key constraint or custom backend message
            setAlertMsg(t('msg.cannot_delete_used'));
        }
    };

    const openCreateModal = () => {
        setErrors({});
        setNewProject({ name: '', description: '', deadline: '', isActive: true });
        setIsCreateOpen(true);
    };

    const openEditModal = (p: Project) => {
        setErrors({});
        setEditingProject({
            ...p,
            name: getLocalized(p.name, lang),
            description: getLocalized(p.description, lang)
        });
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{t('headers.projects')}</h2>
                <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('headers.new_project')}
                </button>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3">{t('form.name')}</th>
                                <th className="px-4 py-3">{t('form.deadline')}</th>
                                <th className="px-4 py-3 text-center">{t('col.unresolved')}</th>
                                <th className="px-4 py-3 text-center">{t('col.overdue')}</th>
                                <th className="px-4 py-3 text-center">{t('col.total')}</th>
                                <th className="px-4 py-3 text-center">{t('form.is_active')}</th>
                                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {projects.map(p => {
                                const stats = getStats(p.id);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {getLocalized(p.name, lang)}
                                            {p.description && <div className="text-xs text-slate-500 font-normal mt-0.5 max-w-xs truncate">{getLocalized(p.description, lang)}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {p.deadline ? new Date(p.deadline).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => onNavigate('requests', { projectId: p.id, status: ['new', 'assigned'] })}
                                                className={`px-2 py-1 rounded text-xs font-bold ${stats.unresolved > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'text-slate-400 bg-slate-50'}`}
                                            >
                                                {stats.unresolved}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                // We pass 'overdue' filter via specific logic in RequestsPage
                                                onClick={() => onNavigate('requests', { projectId: p.id, status: ['new', 'assigned'], isOverdue: true })} 
                                                className={`px-2 py-1 rounded text-xs font-bold ${stats.overdue > 0 ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'text-slate-400 bg-slate-50'}`}
                                            >
                                                {stats.overdue}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-600 font-medium">
                                            {stats.total}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {p.isActive 
                                                ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> 
                                                : <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto" />
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => openEditModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {projects.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Žádné projekty</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <Modal title={t('headers.new_project')} onClose={() => setIsCreateOpen(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.name')}</label>
                            <input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.description')}</label>
                            <textarea className="w-full border p-2 rounded" rows={3} value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.deadline')}</label>
                            <input type="date" className="w-full border p-2 rounded" value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={newProject.isActive} onChange={e => setNewProject({...newProject, isActive: e.target.checked})} />
                            <label className="text-sm font-medium">{t('form.is_active')}</label>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={handleCreate} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center">
                                {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.create')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit Modal */}
            {editingProject && (
                <Modal title={t('headers.edit_project')} onClose={() => setEditingProject(null)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.name')}</label>
                            <input className="w-full border p-2 rounded" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.description')}</label>
                            <textarea className="w-full border p-2 rounded" rows={3} value={editingProject.description} onChange={e => setEditingProject({...editingProject, description: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.deadline')}</label>
                            <input type="date" className="w-full border p-2 rounded" value={editingProject.deadline ? new Date(editingProject.deadline).toISOString().split('T')[0] : ''} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={editingProject.isActive} onChange={e => setEditingProject({...editingProject, isActive: e.target.checked})} />
                            <label className="text-sm font-medium">{t('form.is_active')}</label>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={handleUpdate} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center">
                                {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.save')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteId && <ConfirmModal message={t('msg.confirm_delete')} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
            
            {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
        </div>
    );
};
