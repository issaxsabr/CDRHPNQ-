
import React from 'react';
import { Database, Check, Mail, Phone } from 'lucide-react';

interface DashboardStatsProps {
    stats: {
        total: number;
        emails: number;
        phones: number;
    };
    exportFilters: {
        onlyWithEmail: boolean;
        excludeNoPhone: boolean;
        excludeClosed: boolean;
        excludeDuplicates: boolean;
    };
    onToggleFilter: (type: 'email' | 'phone') => void;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, exportFilters, onToggleFilter }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center gap-1 shadow-sm transition-all hover:shadow-md">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600 mb-1"><Database className="w-5 h-5" /></div>
                <span className="text-3xl font-bold text-slate-900">{stats.total}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Entreprises</span>
            </div>
            <button onClick={() => onToggleFilter('email')} className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer hover:shadow-md ${exportFilters.onlyWithEmail ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mb-1">{exportFilters.onlyWithEmail ? <Check className="w-5 h-5"/> : <Mail className="w-5 h-5" />}</div>
                <span className="text-3xl font-bold text-slate-900">{stats.emails}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Emails</span>
            </button>
            <button onClick={() => onToggleFilter('phone')} className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer hover:shadow-md ${exportFilters.excludeNoPhone ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mb-1">{exportFilters.excludeNoPhone ? <Check className="w-5 h-5"/> : <Phone className="w-5 h-5" />}</div>
                <span className="text-3xl font-bold text-slate-900">{stats.phones}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Téléphones</span>
            </button>
        </div>
    );
};

export default DashboardStats;
