import React from 'react';
import { Project } from '../../types';
import { Folder, Database, Calendar, FileCode, FileSpreadsheet, FileJson, ArrowRight, Check, Trash2, X } from 'lucide-react';
import Button from '../ui/Button';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
    onDeleteProject: (id: string, e: React.MouseEvent) => void;
    onExportProject: (e: React.MouseEvent, project: Project, type: 'xlsx' | 'json' | 'html') => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ 
    isOpen, onClose, projects, activeProjectId, onSelectProject, onDeleteProject, onExportProject 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4">
            <div className="absolute inset-0 glass-dark transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-white rounded-2xl shadow-modal flex flex-col max-h-[85vh] animate-scale-in glass-light">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg"><Folder className="w-5 h-5 text-amber-600" /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight text-earth-900">Mes Dossiers</h3>
                            <p className="text-xs text-slate-500">Gérez vos listes de prospection</p>
                        </div>
                    </div>
                    <Button onClick={onClose} variant="ghost" size="sm" aria-label="Fermer la modale des projets" className="!rounded-full"><X className="w-5 h-5" /></Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-3">
                    {projects.length > 0 ? (
                        projects.map((p) => (
                            <div key={p.id} className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 transition-colors rounded-xl card-hover shadow-card bg-white border border-slate-100 ${activeProjectId === p.id ? 'ring-2 ring-amber-300' : ''}`}>
                                <div className="flex items-start gap-4 cursor-pointer flex-1 animate-fade-in-up w-full" onClick={() => { onSelectProject(p.id); onClose(); }}>
                                    <div className={`p-3 rounded-xl flex items-center justify-center transition-colors ${activeProjectId === p.id ? 'bg-earth-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                                        <Folder className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm ${activeProjectId === p.id ? 'text-amber-900' : 'text-earth-900'}`}>{p.name}</h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Database className="w-3 h-3"/> {p.itemCount} leads</span>
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(p.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                                    <div className="flex items-center gap-1 mr-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                                        <Button variant="ghost" size="sm" onClick={(e) => onExportProject(e, p, 'html')} aria-label={`Exporter le projet ${p.name} en HTML`} title="Télécharger Mini-App HTML"><FileCode className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="sm" onClick={(e) => onExportProject(e, p, 'xlsx')} aria-label={`Exporter le projet ${p.name} en Excel`} title="Télécharger Excel (.xlsx)"><FileSpreadsheet className="w-3.5 h-3.5" /></Button>
                                        <div className="w-px h-3 bg-slate-200"></div>
                                        <Button variant="ghost" size="sm" onClick={(e) => onExportProject(e, p, 'json')} aria-label={`Exporter le projet ${p.name} en JSON`} title="Télécharger JSON"><FileJson className="w-3.5 h-3.5" /></Button>
                                    </div>

                                    {activeProjectId !== p.id ? (
                                        <Button onClick={() => { onSelectProject(p.id); onClose(); }} variant="outline" size="sm" rightIcon={<ArrowRight className="w-3 h-3"/>}>
                                            Ouvrir
                                        </Button>
                                    ) : (
                                        <span className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 rounded-lg border border-amber-100 flex items-center gap-1">
                                            <Check className="w-3 h-3"/> Actif
                                        </span>
                                    )}
                                    <Button onClick={(e) => onDeleteProject(p.id, e)} variant="ghost" size="sm" aria-label={`Supprimer le projet ${p.name}`} className="text-slate-400 hover:text-rose-600" title="Supprimer">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Folder className="w-12 h-12 mb-3 text-slate-200" />
                            <p>Aucun dossier pour le moment.</p>
                            <p className="text-xs">Créez un projet depuis la barre de recherche.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectModal;