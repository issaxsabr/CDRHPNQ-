
import React from 'react';
import { ColumnLabelMap } from '../../types';
import { Settings2, X } from 'lucide-react';

interface ColumnConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    columnLabels: ColumnLabelMap;
    onSaveColumnLabels: (newLabels: ColumnLabelMap) => void;
}

const COLUMN_KEYS: {key: keyof ColumnLabelMap, label: string}[] = [
    { key: 'name', label: "Nom de l'entreprise" },
    { key: 'status', label: "Statut (Ouvert/Fermé)" },
    { key: 'customField', label: "Champ Personnalisé (Extra)" },
    { key: 'category', label: "Catégorie" },
    { key: 'address', label: "Adresse" },
    { key: 'phone', label: "Téléphone" },
    { key: 'hours', label: "Horaires" },
    { key: 'email', label: "Email / Lead Contact" },
];

const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({ isOpen, onClose, columnLabels, onSaveColumnLabels }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 glass-dark transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-scale-in glass">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-indigo-500" /><h3 className="font-bold text-lg gradient-text">Configurer les colonnes</h3></div>
                    <button onClick={onClose} aria-label="Fermer la modale de configuration" className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 overflow-y-auto max-h-[60vh]">
                    <p className="text-xs text-slate-500 mb-4">Personnalisez les noms des en-têtes pour l'affichage et l'export Excel.</p>
                    <div className="space-y-3">
                            {COLUMN_KEYS.map((col) => (
                                <div key={col.key}>
                                <label className="text-xs font-bold text-slate-700">{col.label}</label>
                                <input 
                                    type="text" 
                                    value={columnLabels[col.key]} 
                                    onChange={(e) => onSaveColumnLabels({...columnLabels, [col.key]: e.target.value})}
                                    className="w-full mt-1 p-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all bg-slate-50/50 focus:bg-white"
                                />
                                </div>
                            ))}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">Terminé</button>
                </div>
            </div>
        </div>
    );
};

export default ColumnConfigModal;
