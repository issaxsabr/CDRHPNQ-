import React from 'react';
import { ProjectStatus } from '../types';
import { Loader2, Check, X, Minus, AlertTriangle, Archive, Copy, Info, Search } from 'lucide-react';

interface StatusBadgeProps {
    status: ProjectStatus;
    label?: string;
}

type StatusConfig = {
    className: string;
    icon: React.ReactNode;
    defaultLabel: string;
}

const STATUS_CONFIG: Record<ProjectStatus, StatusConfig> = {
    [ProjectStatus.ACTIVE]: { className: 'status-active', icon: <span className="w-2 h-2 bg-white rounded-full dot"></span>, defaultLabel: 'En Activité' },
    [ProjectStatus.CACHED]: { className: 'status-default', icon: <Archive className="w-2.5 h-2.5" />, defaultLabel: 'En Cache' },
    [ProjectStatus.FOUND]: { className: 'status-active', icon: <Check className="w-2.5 h-2.5" />, defaultLabel: 'Trouvé' },
    [ProjectStatus.CLOSED]: { className: 'status-closed', icon: <AlertTriangle className="w-2.5 h-2.5" />, defaultLabel: 'Fermé' },
    [ProjectStatus.PERMANENTLY_CLOSED]: { className: 'status-permanently-closed', icon: <X className="w-2.5 h-2.5" />, defaultLabel: 'Fermé Déf.' },
    [ProjectStatus.NOT_FOUND]: { className: 'status-error', icon: <X className="w-2.5 h-2.5" />, defaultLabel: 'Introuvable' },
    [ProjectStatus.DUPLICATE]: { className: 'status-warning', icon: <Copy className="w-2.5 h-2.5" />, defaultLabel: 'Doublon' },
    [ProjectStatus.IGNORED]: { className: 'status-warning', icon: <Info className="w-2.5 h-2.5" />, defaultLabel: 'Ignoré' },
    [ProjectStatus.ERROR]: { className: 'status-error', icon: <AlertTriangle className="w-2.5 h-2.5" />, defaultLabel: 'Erreur' },
    [ProjectStatus.WARNING]: { className: 'status-warning', icon: <AlertTriangle className="w-2.5 h-2.5" />, defaultLabel: 'A vérifier' },
    [ProjectStatus.CHECKING]: { className: 'status-checking', icon: <Search className="w-2.5 h-2.5" />, defaultLabel: 'Vérification...' },
};


const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[ProjectStatus.CHECKING];

    return (
        <span className={`status-badge ${config.className}`} title={label || config.defaultLabel}>
            {config.icon}
            <span className="truncate">{label || config.defaultLabel}</span>
        </span>
    );
};

export default React.memo(StatusBadge);