
import React from 'react';

interface StatusBadgeProps {
    status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const s = status?.toLowerCase() || "";

    // Green - Active
    if (s.includes('activ') || s.includes('ouvert') || s.includes('web') || s.includes('trouvé') || s.includes('(cache)')) {
        let text = 'EN ACTIVITÉ';
        if(s.includes('(cache)')) text = 'EN CACHE';
        else if(s.includes('trouvé')) text = 'TROUVÉ';

        return (
            <span className="status-active" title={status}>
                <span className="w-2 h-2 bg-white rounded-full"></span>
                {text}
            </span>
        );
    }

    // Red - Closed / Not Found
    if (s.includes('définitiv') || s.includes('permanent') || s.includes('introuvable')) {
        return (
            <span className="status-closed" title={status}>
                ✕ {s.includes('introuvable') ? 'INTROUVABLE' : 'FERMÉ DÉFINITIVEMENT'}
            </span>
        );
    }
    
    // Orange - Warning / Needs check
    if (s.includes('ferm') || s.includes('doublon') || s.includes('ignoré') || s.includes('erreur')) {
        let text = 'À VÉRIFIER';
        if(s.includes('doublon')) text = 'DOUBLON';
        else if (s.includes('ignoré')) text = 'IGNORÉ';
        else if (s.includes('erreur')) text = 'ERREUR';

         return (
            <span className="status-warning" title={status}>
                ⚠ {text}
            </span>
        );
    }

    // Blue - Default / Fallback for any other status
    return (
        <span className="status-checking" title={status}>
            <span className="relative z-10">
                {/* Shorten text if too long */}
                {status.length > 20 ? status.substring(0, 18) + '...' : status.toUpperCase()}
            </span>
        </span>
    );
};

export default React.memo(StatusBadge);
