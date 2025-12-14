
import { useState, useEffect, useCallback } from 'react';

export const useQuota = (defaultLimit = 5000) => {
    const [quotaLimit, setQuotaLimit] = useState(defaultLimit);
    const [quotaUsed, setQuotaUsed] = useState(0);

    useEffect(() => {
        try {
            const savedLimit = localStorage.getItem('mapscraper_quota_limit');
            const savedUsed = localStorage.getItem('mapscraper_quota_used');
            if(savedLimit) setQuotaLimit(Number(savedLimit));
            if(savedUsed) setQuotaUsed(Number(savedUsed));
        } catch(e) {
            console.error("Failed to read quota from localStorage", e);
        }
    }, []);

    const updateQuotaUsed = useCallback((cost: number) => {
        setQuotaUsed(prev => {
            const newValue = prev + cost;
            try {
                localStorage.setItem('mapscraper_quota_used', String(newValue));
            } catch(e) { console.error("Failed to save quota to localStorage", e); }
            return newValue;
        });
    }, []);

    const handleUpdateQuotaLimit = useCallback((limit: number) => {
        setQuotaLimit(limit);
        try {
            localStorage.setItem('mapscraper_quota_limit', String(limit));
        } catch(e) { console.error("Failed to save quota limit to localStorage", e); }
    }, []);

    const handleResetQuota = useCallback(() => {
        setQuotaUsed(0);
        try {
            localStorage.setItem('mapscraper_quota_used', '0');
        } catch(e) { console.error("Failed to reset quota in localStorage", e); }
    }, []);

    return {
        quotaLimit,
        quotaUsed,
        updateQuotaUsed,
        handleUpdateQuotaLimit,
        handleResetQuota
    };
};
