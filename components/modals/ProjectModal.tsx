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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 glass-dark transition-opacity" onClick={onClose} />
            <div className="relative w-full w-[95vw] sm:w-full max-w-lg lg:max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[75vh] sm:max-h-[85vh] animate-scale-in glass-indigo">
                <div className="p-5 border-b border-white/20 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/50 rounded-lg"><Folder className="w-5 h-5 text-gold-600" /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight gradient-text">Mes Dossiers</h3>
                            <p className="text-xs text-earth-500">Gérez vos listes de prospection</p>
                        </div>
                    </div>
                    <Button onClick={onClose} variant="ghost" size="icon" rounded="full" className="hover:bg-black/5 text-earth-500"><X className="w-5 h-5" /></Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 bg-white/80 space-y-3">
                    {projects.length > 0 ? (
                        projects.map((p) => (
                            <div key={p.id} className={`group flex items-center justify-between p-4 transition-colors rounded-xl card-hover card-glow shadow-elegant bg-white/50 border border-white ${activeProjectId === p.id ? 'ring-2 ring-gold-500/50' : ''}`}>
                                <div className="flex items-start gap-4 cursor-pointer flex-1 animate-fade-in-up" onClick={() => { onSelectProject(p.id); onClose(); }}>
                                    <div className={`p-3 rounded-xl flex items-center justify-center transition-colors ${activeProjectId === p.id ? 'bg-gold-500 text-white shadow-md' : 'bg-beige-100 text-earth-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                                        <Folder className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm ${activeProjectId === p.id ? 'text-gold-600' : 'text-earth-900'}`}>{p.name}</h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-earth-500">
                                            <span className="flex items-center gap-1"><Database className="w-3 h-3"/> {p.itemCount} leads</span>
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(p.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-1 mr-2 bg-white/80 rounded-lg border border-beige-300 p-1 shadow-sm">
                                        <Button 
                                            onClick={(e) => onExportProject(e, p, 'html')}
                                            variant="ghost"
                                            size="icon"
                                            className="w-7 h-7 text-earth-500 hover:text-gold-600 hover:bg-gold-500/10"
                                            title="Télécharger Mini-App HTML"
                                        >
                                            <FileCode className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                            onClick={(e) => onExportProject(e, p, 'xlsx')}
                                            variant="ghost"
                                            size="icon"
                                            className="w-7 h-7 text-earth-500 hover:text-green-600 hover:bg-green-50"
                                            title="Télécharger Excel (.xlsx)"
                                        >
                                            <FileSpreadsheet className="w-3.5 h-3.5" />
                                        </Button>
                                        <div className="w-px h-3 bg-beige-300"></div>
                                        <Button 
                                            onClick={(e) => onExportProject(e, p, 'json')}
                                            variant="ghost"
                                            size="icon"
                                            className="w-7 h-7 text-earth-500 hover:text-amber-600 hover:bg-amber-50"
                                            title="Télécharger JSON"
                                        >
                                            <FileJson className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>

                                    {activeProjectId !== p.id ? (
                                        <Button onClick={() => { onSelectProject(p.id); onClose(); }} variant="secondary" size="xs" rightIcon={<ArrowRight className="w-3 h-3"/>} className="hover:text-gold-600">
                                            Ouvrir
                                        </Button>
                                    ) : (
                                        <span className="px-3 py-1.5 text-xs font-bold text-gold-600 bg-gold-500/10 rounded-lg border border-gold-500/20 flex items-center gap-1">
                                            <Check className="w-3 h-3"/> Actif
                                        </span>
                                    )}
                                    <Button onClick={(e) => onDeleteProject(p.id, e)} variant="ghost" size="icon" className="text-earth-500 hover:text-rose-600 hover:bg-rose-50" title="Supprimer">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-earth-500">
                            <Folder className="w-12 h-12 mb-3 text-beige-200" />
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