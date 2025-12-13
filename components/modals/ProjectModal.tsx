
import React from 'react';
import { Project } from '../../types';
import { Folder, Database, Calendar, FileCode, FileSpreadsheet, FileJson, ArrowRight, Check, Trash2, X } from 'lucide-react';

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-3 text-slate-800">
                        <div className="p-2 bg-indigo-50 rounded-lg"><Folder className="w-5 h-5 text-indigo-600" /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Mes Dossiers</h3>
                            <p className="text-xs text-slate-500">Gérez vos listes de prospection</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0 bg-white">
                    {projects.length > 0 ? (
                        <div className="grid grid-cols-1 divide-y divide-slate-50">
                            {projects.map((p) => (
                                <div key={p.id} className={`group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${activeProjectId === p.id ? 'bg-indigo-50/30' : ''}`}>
                                    <div className="flex items-start gap-4 cursor-pointer flex-1" onClick={() => { onSelectProject(p.id); onClose(); }}>
                                        <div className={`p-3 rounded-xl flex items-center justify-center transition-colors ${activeProjectId === p.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                                            <Folder className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${activeProjectId === p.id ? 'text-indigo-900' : 'text-slate-800'}`}>{p.name}</h4>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Database className="w-3 h-3"/> {p.itemCount} leads</span>
                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(p.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-1 mr-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                                            <button 
                                                onClick={(e) => onExportProject(e, p, 'html')}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="Télécharger Mini-App HTML"
                                            >
                                                <FileCode className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={(e) => onExportProject(e, p, 'xlsx')}
                                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                                title="Télécharger Excel (.xlsx)"
                                            >
                                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="w-px h-3 bg-slate-200"></div>
                                            <button 
                                                onClick={(e) => onExportProject(e, p, 'json')}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                                title="Télécharger JSON"
                                            >
                                                <FileJson className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {activeProjectId !== p.id ? (
                                            <button onClick={() => { onSelectProject(p.id); onClose(); }} className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-1 transition-all">
                                                Ouvrir <ArrowRight className="w-3 h-3"/>
                                            </button>
                                        ) : (
                                                <span className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center gap-1">
                                                <Check className="w-3 h-3"/> Actif
                                            </span>
                                        )}
                                        <button onClick={(e) => onDeleteProject(p.id, e)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Supprimer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
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
