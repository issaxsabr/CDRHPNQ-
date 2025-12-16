
import React from 'react';
import { MapIcon, Folder, Database, LogOut, HelpCircle } from 'lucide-react';

interface HeaderProps {
    projectCount: number;
    historyCount: number;
    onOpenProjectModal: () => void;
    onOpenCacheModal: () => void;
    onLogout: () => void;
    onStartTour: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    projectCount, historyCount, onOpenProjectModal, onOpenCacheModal, onLogout, onStartTour 
}) => {
  return (
    <header className="fixed top-0 w-full z-50 glass-header">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
                    <div className="relative w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                        <MapIcon className="w-5 h-5 text-[#FCC036]" />
                    </div>
                </div>
                <h1 className="text-lg font-bold tracking-tight text-[#EBE6DA]">
                    CDRHPNQ 
                </h1>
            </div>
            <div id="header-controls" className="flex items-center gap-4">
                <button onClick={onOpenProjectModal} className="flex items-center gap-2 text-xs font-medium text-[#EBE6DA] bg-white/10 px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-all shadow-sm cursor-pointer group">
                    <Folder className="w-3.5 h-3.5 text-[#FCC036]" />
                    <span>Dossiers ({projectCount})</span>
                </button>
                <button onClick={onOpenCacheModal} className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#EBE6DA] bg-white/10 px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-all shadow-sm cursor-pointer group">
                    <Database className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#FCC036]" />
                    <span>Cache ({historyCount})</span>
                </button>
                <button onClick={onStartTour} className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#EBE6DA] bg-white/10 px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-all shadow-sm cursor-pointer group">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#FCC036]" />
                    <span>Aide</span>
                </button>
                <button onClick={onLogout} className="flex items-center gap-2 text-xs font-medium text-rose-300 bg-white/10 px-3 py-1.5 rounded-full border border-rose-200/20 hover:bg-rose-500/30 transition-all shadow-sm cursor-pointer">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Déconnexion</span>
                </button>
            </div>
        </div>
    </header>
  );
};

export default React.memo(Header);