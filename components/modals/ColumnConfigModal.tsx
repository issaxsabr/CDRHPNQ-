import React from 'react';
import { ColumnLabelMap } from '../../types';
import { Settings2, X } from 'lucide-react';
import Button from '../ui/Button';

interface ColumnConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    columnLabels: ColumnLabelMap;
    onSaveColumnLabels: (newLabels: ColumnLabelMap) => void;
}

const COLUMN_KEYS: {key: keyof ColumnLabelMap, label: string}[] = [
    { key: 'name', label: "Nom de l'entreprise" },
    { key: 'qualityScore', label: "Score Qualité" },
    { key: 'status', label: "Statut (Ouvert/Fermé)" },
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
            <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-scale-in glass">
                    <div className="p-4 border-b border-beige-200 flex items-center justify-between bg-beige-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-gold-500" /><h3 className="font-bold text-lg gradient-text">Configurer les colonnes</h3></div>
                    <Button onClick={onClose} variant="ghost" size="icon" rounded="full" className="hover:bg-beige-100 text-earth-500"><X className="w-5 h-5" /></Button>
                </div>
                <div className="p-5 overflow-y-auto max-h-[60vh]">
                    <p className="text-xs text-earth-500 mb-4">Personnalisez les noms des en-têtes pour l'affichage et l'export Excel.</p>
                    <div className="space-y-3">
                            {COLUMN_KEYS.map((col) => (
                                <div key={col.key}>
                                <label className="text-xs font-bold text-earth-700">{col.label}</label>
                                <input 
                                    type="text" 
                                    value={columnLabels[col.key]} 
                                    onChange={(e) => onSaveColumnLabels({...columnLabels, [col.key]: e.target.value})}
                                    className="w-full mt-1 p-2 text-sm border border-beige-300 rounded-lg outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 transition-all bg-beige-50/50 focus:bg-white"
                                />
                                </div>
                            ))}
                    </div>
                </div>
                <div className="p-4 border-t border-beige-200 flex justify-end">
                    <Button onClick={onClose} variant="primary" size="sm">Terminé</Button>
                </div>
            </div>
        </div>
    );
};

export default ColumnConfigModal;