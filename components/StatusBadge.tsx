
import React, { useMemo } from 'react';
import { ProjectStatus } from '../types';

interface StatusBadgeProps {
    status: string | ProjectStatus;
}

interface StatusConfig {
    className: string;
    icon?: React.ReactNode;
    defaultLabel: string;
}

const STATUS_CONFIG: Record<ProjectStatus, StatusConfig> = {
    [ProjectStatus.ACTIVE]: {
        className: 'status-active',
        defaultLabel: 'EN ACTIVITÉ'
    },
    [ProjectStatus.CACHED]: {
        className: 'status-active', // Même style visuel que Active
        defaultLabel: 'EN CACHE'
    },
    [ProjectStatus.FOUND]: {
        className: 'status-active',
        defaultLabel: 'TROUVÉ'
    },
    [ProjectStatus.CLOSED]: {
        className: 'status-closed',
        defaultLabel: 'FERMÉ DÉFINITIVEMENT'
    },
    [ProjectStatus.NOT_FOUND]: {
        className: 'status-closed',
        defaultLabel: 'INTROUVABLE'
    },
    [ProjectStatus.DUPLICATE]: {
        className: 'status-warning',
        defaultLabel: 'DOUBLON'
    },
    [ProjectStatus.IGNORED]: {
        className: 'status-warning',
        defaultLabel: 'IGNORÉ'
    },
    [ProjectStatus.ERROR]: {
        className: 'status-warning',
        defaultLabel: 'ERREUR'
    },
    [ProjectStatus.WARNING]: {
        className: 'status-warning',
        defaultLabel: 'À VÉRIFIER'
    },
    [ProjectStatus.UNKNOWN]: {
        className: 'status-checking',
        defaultLabel: 'INCONNU'
    }
};

const normalizeStatus = (rawStatus: string): ProjectStatus => {
    if (!rawStatus) return ProjectStatus.UNKNOWN;
    
    // Check if it's already a valid enum value
    if (Object.values(ProjectStatus).includes(rawStatus as ProjectStatus)) {
        return rawStatus as ProjectStatus;
    }

    const s = rawStatus.toLowerCase();

    if (s.includes('cache')) return ProjectStatus.CACHED;
    if (s.includes('activ') || s.includes('ouvert') || s.includes('web')) return ProjectStatus.ACTIVE;
    if (s.includes('trouvé') || s.includes('found')) return ProjectStatus.FOUND;
    
    if (s.includes('introuvable')) return ProjectStatus.NOT_FOUND;
    if (s.includes('définitiv') || s.includes('permanent') || s.includes('closed')) return ProjectStatus.CLOSED;
    
    if (s.includes('doublon')) return ProjectStatus.DUPLICATE;
    if (s.includes('ignoré')) return ProjectStatus.IGNORED;
    if (s.includes('erreur')) return ProjectStatus.ERROR;
    if (s.includes('ferm')) return ProjectStatus.WARNING; // "Fermé temporairement" ou juste "Fermé" sans précision

    return ProjectStatus.UNKNOWN;
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const normalizedStatus = useMemo(() => normalizeStatus(status), [status]);
    const config = STATUS_CONFIG[normalizedStatus];
    
    // Si le statut original contient plus de détails (ex: "Ignoré: Domaine blacklisté"), 
    // on l'utilise pour le titre ou l'affichage si c'est pertinent, 
    // sinon on utilise le label par défaut.
    const displayLabel = (normalizedStatus === ProjectStatus.UNKNOWN || normalizedStatus === ProjectStatus.WARNING) 
        ? (status.length > 20 ? status.substring(0, 18) + '...' : status.toUpperCase())
        : config.defaultLabel;

    return (
        <span className={config.className} title={typeof status === 'string' ? status : config.defaultLabel}>
            {config.className === 'status-active' && <span className="w-2 h-2 bg-white rounded-full"></span>}
            {config.className === 'status-closed' && <span className="mr-1">✕</span>}
            {config.className === 'status-warning' && <span className="mr-1">⚠</span>}
            <span className="relative z-10">{displayLabel}</span>
        </span>
    );
};

export default React.memo(StatusBadge);
