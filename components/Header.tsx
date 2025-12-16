
import React from 'react';
import { MapIcon, Folder, Database, LogOut, HelpCircle } from 'lucide-react';
import Button from './ui/Button';
import Container from './ui/Container';

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
        <Container size="lg" className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-gold-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000"></div>
                    <div className="relative w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-beige-200">
                        <MapIcon className="w-5 h-5 text-gold-500" aria-hidden="true" />
                    </div>
                </div>
                <h1 className="text-lg font-bold tracking-tight text-beige-100 hidden xs:block">
                    CDRHPNQ 
                </h1>
            </div>
            <nav id="header-controls" className="flex items-center gap-4" aria-label="Navigation principale">
                <Button 
                    variant="glass" 
                    size="sm" 
                    rounded="full" 
                    onClick={onOpenProjectModal} 
                    leftIcon={<Folder className="w-3.5 h-3.5 text-gold-500" aria-hidden="true" />}
                    className="group"
                    aria-label={`Dossiers (${projectCount})`}
                >
                    <span className="hidden sm:inline">Dossiers ({projectCount})</span>
                    <span className="sm:hidden">{projectCount}</span>
                </Button>

                <Button 
                    variant="glass" 
                    size="sm" 
                    rounded="full" 
                    onClick={onOpenCacheModal} 
                    leftIcon={<Database className="w-3.5 h-3.5 text-beige-300 group-hover:text-gold-500" aria-hidden="true" />}
                    className="hidden sm:inline-flex group"
                    aria-label={`Cache (${historyCount} éléments)`}
                >
                    <span>Cache ({historyCount})</span>
                </Button>

                <Button 
                    variant="glass" 
                    size="sm" 
                    rounded="full" 
                    onClick={onStartTour} 
                    leftIcon={<HelpCircle className="w-3.5 h-3.5 text-beige-300 group-hover:text-gold-500" aria-hidden="true" />}
                    className="hidden sm:inline-flex group"
                    aria-label="Aide et tutoriel"
                >
                    <span>Aide</span>
                </Button>

                <Button 
                    variant="glass-danger" 
                    size="sm" 
                    rounded="full" 
                    onClick={onLogout} 
                    leftIcon={<LogOut className="w-3.5 h-3.5" aria-hidden="true" />}
                    aria-label="Se déconnecter"
                >
                    <span className="hidden sm:inline">Déconnexion</span>
                </Button>
            </nav>
        </Container>
    </header>
  );
};

export default React.memo(Header);
