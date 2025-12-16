import React from 'react';
import { MapIcon, Folder, Database, LogOut, HelpCircle } from 'lucide-react';
import Button from './ui/Button';

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
    <header className="fixed top-0 w-full z-[var(--z-header)] glass-header">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-gold-500 to-amber-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
                    <div className="relative w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                        <MapIcon className="w-5 h-5 text-gold-500" />
                    </div>
                </div>
                <h1 className="text-lg font-bold tracking-tight gradient-text">
                    CDRHPNQ 
                </h1>
            </div>
            <div id="header-controls" className="flex items-center gap-2 sm:gap-4">
                <Button variant="secondary" size="sm" onClick={onOpenProjectModal} leftIcon={<Folder className="w-3.5 h-3.5 text-gold-500" />}>
                    Dossiers ({projectCount})
                </Button>
                <Button variant="secondary" size="sm" onClick={onOpenCacheModal} leftIcon={<Database className="w-3.5 h-3.5 text-slate-300 group-hover:text-gold-500" />} className="hidden sm:inline-flex">
                    Cache ({historyCount})
                </Button>
                <Button variant="secondary" size="sm" onClick={onStartTour} leftIcon={<HelpCircle className="w-3.5 h-3.5 text-slate-300 group-hover:text-gold-500" />} className="hidden sm:inline-flex">
                    Aide
                </Button>
                <Button variant="danger" size="sm" onClick={onLogout} leftIcon={<LogOut className="w-3.5 h-3.5" />} className="!bg-white/10 !text-rose-300 border-rose-200/20 hover:!bg-rose-500/30">
                    <span className="hidden sm:inline">Déconnexion</span>
                </Button>
            </div>
        </div>
    </header>
  );
};

export default React.memo(Header);