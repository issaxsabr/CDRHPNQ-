
import React from 'react';
import { MapIcon, Folder, Database, LogOut } from 'lucide-react';

interface HeaderProps {
    projectCount: number;
    historyCount: number;
    onOpenProjectModal: () => void;
    onOpenCacheModal: () => void;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    projectCount, historyCount, onOpenProjectModal, onOpenCacheModal, onLogout 
}) => {
  return (
    <header className="fixed top-0 w-full z-50 border-b border-slate-200/50 glass shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
                    <div className="relative w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                        <MapIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                </div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                    CDRHPNQ 
                </h1>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={onOpenProjectModal} className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-all shadow-sm cursor-pointer hover:border-indigo-300 group">
                    <Folder className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-600" />
                    <span>Dossiers ({projectCount})</span>
                </button>
                <button onClick={onOpenCacheModal} className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-all shadow-sm cursor-pointer hover:border-indigo-300 group">
                    <Database className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                    <span>Cache ({historyCount})</span>
                </button>
                <button onClick={onLogout} className="flex items-center gap-2 text-xs font-medium text-rose-500 bg-white px-3 py-1.5 rounded-full border border-rose-100 hover:bg-rose-50 transition-all shadow-sm cursor-pointer hover:border-rose-300">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Déconnexion</span>
                </button>
            </div>
        </div>
    </header>
  );
};

export default React.memo(Header);
