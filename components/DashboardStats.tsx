
import React, { useEffect, useState } from 'react';
import { Mail, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface DashboardStatsProps {
    stats: {
        actives: number;
        closed: number;
        warnings: number;
        emails: number;
    };
}

// Custom hook for number animation
const useCountUp = (end: number, duration = 800) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        let start = 0;
        const startTime = Date.now();

        const easeOutCubic = (t: number) => (--t) * t * t + 1;

        const animate = () => {
            const now = Date.now();
            const progress = (now - startTime) / duration;
            
            if (progress < 1) {
                setCount(Math.round(start + (end - start) * easeOutCubic(progress)));
                requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };

        setCount(0); // Reset before starting
        requestAnimationFrame(animate);

    }, [end, duration]);
    
    return count;
};


interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    trendText: string;
    color: 'emerald' | 'rose' | 'amber' | 'indigo';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trendText, color }) => {
    const animatedValue = useCountUp(value);
    
    const colors = {
        emerald: 'text-emerald-600',
        rose: 'text-rose-600',
        amber: 'text-amber-600',
        indigo: 'text-indigo-600',
    };
    const trendColors = {
        emerald: 'stat-trend up',
        rose: 'stat-trend down',
        amber: 'stat-trend',
        indigo: 'stat-trend',
    };

    return (
        <div className="card-hover bg-white rounded-xl p-5 border border-slate-200 shadow-sm text-center">
            <div className={`stat-counter ${colors[color]}`} key={value}>
                {animatedValue}
            </div>
            <div className="stat-label mt-1">{label}</div>
            <div className={`${trendColors[color]}`}>
                {icon}
                <span>{trendText}</span>
            </div>
        </div>
    );
};


const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in-up">
            <StatCard 
                label="Actives"
                value={stats.actives}
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                trendText="Données valides"
                color="emerald"
            />
            <StatCard 
                label="Fermées"
                value={stats.closed}
                icon={<TrendingDown className="w-3.5 h-3.5" />}
                trendText="À retirer"
                color="rose"
            />
            <StatCard 
                label="À vérifier"
                value={stats.warnings}
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                trendText="Statut incertain"
                color="amber"
            />
            <StatCard 
                label="Emails Trouvés"
                value={stats.emails}
                icon={<Mail className="w-3.5 h-3.5" />}
                trendText="Contacts potentiels"
                color="indigo"
            />
        </div>
    );
};

export default React.memo(DashboardStats);
