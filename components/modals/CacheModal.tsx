import React from 'react';
import { Database, X, CheckSquare, Trash2 } from 'lucide-react';
import { BusinessData } from '../../types';
import Button from '../ui/Button';

interface CacheItem {
    term: string;
    data: BusinessData;
    timestamp: number;
}

interface CacheModalProps {
    isOpen: boolean;
    onClose: () => void;
    cachedItems: CacheItem[];
    selectedCacheKeys: Set<string>;
    onClearCache: () => void;
    onToggleSelectCacheItem: (term: string) => void;
    onToggleSelectAllCache: () => void;
}

const CacheModal: React.FC<CacheModalProps> = ({ 
    isOpen, onClose, cachedItems, selectedCacheKeys, onClearCache, onToggleSelectCacheItem, onToggleSelectAllCache 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4">
            <div className="absolute inset-0 glass-dark transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-modal flex flex-col max-h-[80vh] animate-scale-in glass-light">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2"><Database className="w-5 h-5 text-amber-500" /><h3 className="font-bold text-lg text-earth-900">Cache Local (24h)</h3></div>
                    <Button onClick={onClose} variant="ghost" size="sm" aria-label="Fermer la modale du cache" className="!rounded-full"><X className="w-5 h-5" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {cachedItems.length > 0 ? (
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-white/50 sticky top-0 z-10 shadow-sm text-slate-400 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-4 py-3 w-10 text-center"><button onClick={onToggleSelectAllCache} aria-label="Tout sélectionner" className="hover:text-slate-800"><CheckSquare className="w-4 h-4"/></button></th>
                                    <th className="px-2 py-3 font-semibold">Terme</th>
                                    <th className="px-2 py-3 font-semibold">Résultat</th>
                                    <th className="px-4 py-3 font-semibold text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {cachedItems.map((item, idx) => (
                                    <tr key={idx} className={`transition-colors cursor-pointer ${selectedCacheKeys.has(item.term) ? 'bg-amber-50' : 'hover:bg-slate-50/50'}`} onClick={() => onToggleSelectCacheItem(item.term)}>
                                        <td className="px-4 py-3 text-center"><div className={`${selectedCacheKeys.has(item.term) ? 'text-amber-600' : 'text-slate-300'}`}><CheckSquare className="w-4 h-4"/></div></td>
                                        <td className="px-2 py-3 font-medium text-earth-900"><span className="truncate max-w-[180px]">{item.term}</span></td>
                                        <td className="px-2 py-3">{item.data.name || "Erreur"}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <div className="p-8 text-center text-slate-400">Le cache est vide.</div>}
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white/50 rounded-b-2xl">
                        <Button onClick={onClearCache} disabled={cachedItems.length === 0} variant="danger" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5"/>}>Vider</Button>
                </div>
            </div>
        </div>
    );
};

export default CacheModal;