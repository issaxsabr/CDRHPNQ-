import React, { useState, useEffect, useRef } from 'react';
import { BusinessData, ContactPerson, ColumnLabelMap, ProjectStatus } from '../types';
import { Clock, Phone, MapPin, Globe, Tag, MapIcon, Mail, Facebook, Linkedin, Check, Plus, User, Copy, Edit2, Building2, PenTool, Star } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import StatusBadge from './StatusBadge';
import Card from './ui/Card';

interface ResultTableProps {
  data: BusinessData[];
  onUpdate: (index: number, field: keyof BusinessData, value: any) => void;
  columnLabels: ColumnLabelMap;
}

const EditableCell = ({ 
    value, 
    onSave, 
    type = "text",
    className = "",
    placeholder = "Non défini"
}: { 
    value: string; 
    onSave: (val: string) => void; 
    type?: "text" | "email" | "tel";
    className?: string;
    placeholder?: string;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (tempValue !== value) {
            onSave(tempValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setTempValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type={type}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full bg-white border border-amber-500 rounded px-1.5 py-0.5 text-xs text-earth-900 outline-none shadow-sm ${className}`}
            />
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)}
            className={`cursor-text hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 transition-colors border border-transparent hover:border-slate-200 group/cell relative ${className}`}
            title="Cliquer pour éditer"
        >
            {value || <span className="italic text-slate-300">{placeholder}</span>}
            <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <Edit2 className="w-2.5 h-2.5 text-slate-400" />
            </span>
        </div>
    );
};

const MobileResultCard: React.FC<{ item: BusinessData, index: number, onUpdate: ResultTableProps['onUpdate'] }> = ({ item, index, onUpdate }) => {
    const domain = item.website ? new URL(item.website).hostname : null;
    const primaryPhone = item.phone && item.phone !== 'N/A' ? item.phone : (item.phones && item.phones.length > 0 ? item.phones[0] : "");
    const primaryEmail = item.email ? item.email : (item.emails && item.emails.length > 0 ? item.emails[0] : "");

    return (
        <Card className="mb-4 !p-4">
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <EditableCell 
                        value={item.name} 
                        onSave={(val) => onUpdate(index, 'name', val)}
                        className="font-semibold text-earth-900 text-base"
                    />
                    {item.category && <p className="text-xs text-slate-500 mt-1">{item.category}</p>}
                </div>
                <StatusBadge status={item.status} label={item.statusLabel} />
            </div>
            <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <EditableCell value={item.address} onSave={(val) => onUpdate(index, 'address', val)} className="text-slate-600 text-xs" />
                </div>
                <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <EditableCell value={primaryPhone} onSave={(val) => onUpdate(index, 'phone', val)} className="text-slate-600 text-xs font-mono" />
                </div>
                <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <EditableCell value={primaryEmail} onSave={(val) => onUpdate(index, 'email', val)} className="text-slate-600 text-xs font-mono" />
                </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-[10px] font-medium shadow-sm hover-lift"><Globe className="w-3 h-3 shrink-0 text-slate-400" /> Web</a>}
                {item.sourceUri && <a href={item.sourceUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-white bg-earth-900 hover:bg-black px-2.5 py-1 rounded-md shadow-sm text-[10px] font-medium hover-lift"><MapIcon className="w-3 h-3 shrink-0 text-slate-400" /> Maps</a>}
            </div>
        </Card>
    );
};


const ResultTable: React.FC<ResultTableProps> = ({ data, onUpdate, columnLabels }) => {
  if (data.length === 0) {
    return null;
  }

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
  };

  const getLabelForEmail = (email: string, decisionMakers?: ContactPerson[]) => {
      if (!decisionMakers || decisionMakers.length === 0) return email;
      const maker = decisionMakers.find(dm => dm.email && dm.email.toLowerCase() === email.toLowerCase());
      if (maker) { 
          return maker.title ? `${maker.title}: ${email}` : `${maker.name}: ${email}`; 
      }
      return email;
  };

  const getDomain = (url?: string) => {
      if(!url) return null;
      try { return new URL(url).hostname; } catch (e) { return null; }
  };

  const gridTemplateColumns = "21% 7% 8% 10% 15% 10% 11% 12% 6%";
  const ROW_HEIGHT = 80;

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = data[index];
    const rowId = `row-${index}`;
    
    const primaryPhone = item.phone && item.phone !== 'N/A' ? item.phone : (item.phones && item.phones.length > 0 ? item.phones[0] : "");
    const primaryEmail = item.email ? item.email : (item.emails && item.emails.length > 0 ? item.emails[0] : "");
    const secondaryPhones = item.phones ? item.phones.filter(p => p !== primaryPhone) : [];
    const secondaryEmails = item.emails ? item.emails.filter(e => e !== primaryEmail) : [];
    const domain = getDomain(item.website);

    const scoreColor = (score: number) => {
        if (score >= 80) return "bg-emerald-500";
        if (score >= 60) return "bg-sky-500";
        if (score >= 40) return "bg-amber-500";
        return "bg-rose-500";
    }

    return (
      <div 
        style={{
            ...style,
            display: 'grid',
            gridTemplateColumns
        }} 
        className="items-center border-b border-slate-100 transition-colors hover:bg-slate-50 hover:z-50 group text-sm text-earth-700 relative bg-white table-row-stable"
      >
        {/* 1. Entreprise */}
        <div className="px-4 py-2 flex flex-col gap-1 h-full justify-center relative border-r border-transparent group-hover:border-slate-100">
            <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                    {item.website ? (
                        <img 
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                            alt="logo" 
                            className="w-5 h-5 rounded bg-white shadow-sm object-contain border border-slate-100"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                             <Building2 className="w-3 h-3" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <EditableCell 
                        value={item.name} 
                        onSave={(val) => onUpdate(index, 'name', val)}
                        className="font-semibold text-earth-900 leading-tight"
                    />
                </div>
            </div>
            {item.searchedTerm && item.name.toLowerCase() !== item.searchedTerm.toLowerCase() && (
                <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none pl-8">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0"></span>
                    <span className="truncate max-w-full">Req: "{item.searchedTerm}"</span>
                </div>
            )}
        </div>

        {/* 2. Qualité */}
        <div className="px-3 py-2 flex flex-col items-start justify-center gap-1 h-full relative border-r border-transparent group-hover:border-slate-100">
            {item.qualityScore !== undefined && (
                <div className="w-full">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Score</span>
                        <span className="text-earth-900">{item.qualityScore}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${scoreColor(item.qualityScore)}`} style={{ width: `${item.qualityScore}%`}}></div>
                    </div>
                </div>
            )}
        </div>

        {/* 3. Statut API */}
        <div className="px-3 py-2 flex flex-col items-start justify-center gap-1.5 h-full relative border-r border-transparent group-hover:border-slate-100">
            <StatusBadge status={item.status} label={item.statusLabel} />
        </div>

        {/* 4. Catégorie */}
        <div className="px-3 py-2 h-full flex items-center border-r border-transparent group-hover:border-slate-100">
            {item.category ? (
                <span className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded inline-flex items-center gap-1.5 leading-tight max-w-full">
                    <Tag className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate" title={item.category}>{item.category}</span>
                </span>
            ) : (
                <span className="text-slate-300 text-xs select-none pl-2">-</span>
            )}
        </div>

        {/* 5. Adresse */}
        <div className="px-4 py-2 flex flex-col justify-center gap-1.5 text-xs h-full border-r border-transparent group-hover:border-slate-100">
             <div className="flex items-start gap-2 group/addr">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <EditableCell 
                        value={item.address} 
                        onSave={(val) => onUpdate(index, 'address', val)}
                        className="text-slate-600 text-[11px]"
                    />
                </div>
            </div>
        </div>

        {/* 6. Téléphones */}
        <div className="px-4 py-2 flex flex-col justify-center h-full relative border-r border-transparent group-hover:border-slate-100">
            <div className="flex flex-col gap-1 items-start w-full">
                <div className="flex items-center gap-1 w-full group/phone">
                    <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                    <div className="flex-1 min-w-0 font-mono text-[11px] text-earth-700">
                         <EditableCell 
                            value={primaryPhone} 
                            onSave={(val) => onUpdate(index, 'phone', val)}
                            type="tel"
                        />
                    </div>
                    {primaryPhone && (
                        <button 
                            onClick={() => copyToClipboard(primaryPhone, `${rowId}-phone`)}
                            aria-label="Copier le numéro de téléphone principal"
                            className="p-1 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded opacity-0 group-hover/phone:opacity-100 transition-opacity"
                            title="Copier"
                        >
                            {copiedId === `${rowId}-phone` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                    )}
                </div>
                {secondaryPhones.length > 0 && (
                    <div className="relative group/dropdown ml-4">
                        <button aria-label="Afficher les numéros de téléphone secondaires" className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 rounded cursor-pointer w-fit transition-colors">
                            <Plus className="w-2.5 h-2.5" />
                            <span>{secondaryPhones.length}</span>
                        </button>
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-1 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-[var(--z-dropdown)]">
                            {secondaryPhones.map((ph, idx) => (
                                <button key={idx} onClick={(e) => { e.stopPropagation(); copyToClipboard(ph, `${rowId}-phone-${idx+1}`); }} aria-label={`Copier le numéro de téléphone ${ph}`} className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] text-earth-700 hover:bg-slate-50 rounded cursor-pointer font-mono">
                                    {ph}
                                    {copiedId === `${rowId}-phone-${idx+1}` ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* 7. Horaires */}
        <div className="px-4 py-2 h-full flex items-center border-r border-transparent group-hover:border-slate-100">
            <div className="flex items-start gap-2 group/time w-full">
                <Clock className="w-3.5 h-3.5 text-slate-300 group-hover/time:text-slate-500 transition-colors mt-0.5 shrink-0" />
                <div className="flex flex-col min-w-0">
                    {item.hours && item.hours !== 'N/A' && item.hours !== 'Voir Fiche Maps' ? (
                        <span className="text-slate-600 text-[10px] leading-snug line-clamp-2" title={item.hours.replace(/ \| /g, '\n')}>{item.hours}</span>
                    ) : (<span className="text-slate-300 italic text-[10px]">Non dispo</span>)}
                </div>
            </div>
        </div>

        {/* 8. Lead Contact */}
        <div className="px-4 py-2 h-full overflow-visible flex flex-col justify-center gap-1.5 relative border-r border-transparent group-hover:border-slate-100">
            {item.decisionMakers && item.decisionMakers.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 w-fit max-w-full shadow-sm" title={item.decisionMakers[0].title || "Décideur"}>
                    <User className="w-3 h-3 shrink-0 text-amber-500" />
                    <span className="truncate">{item.decisionMakers[0].name}</span>
                </div>
            )}
            <div className="flex flex-col gap-1 items-start w-full">
                <div className="flex items-center gap-2 w-full group/email">
                    <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                    <div className="flex-1 min-w-0 font-mono text-[10px] text-earth-700">
                        <EditableCell value={primaryEmail} onSave={(val) => onUpdate(index, 'email', val)} type="email" placeholder="Email..."/>
                    </div>
                     {primaryEmail && (
                        <button onClick={() => copyToClipboard(primaryEmail, `${rowId}-email`)} aria-label="Copier l'adresse email principale" className="p-1 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded opacity-0 group-hover/email:opacity-100 transition-opacity" title="Copier">
                            {copiedId === `${rowId}-email` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                    )}
                </div>
                {secondaryEmails.length > 0 && (
                    <div className="relative group/dropdown ml-5">
                        <button aria-label="Afficher les adresses email secondaires" className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 rounded cursor-pointer w-fit transition-colors">
                            <Plus className="w-2.5 h-2.5" /><span>{secondaryEmails.length}</span>
                        </button>
                        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-1 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-[var(--z-dropdown)]">
                            <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider bg-slate-50 rounded-t">Autres emails</div>
                            {secondaryEmails.map((em, idx) => (
                                <button key={idx} onClick={(e) => { e.stopPropagation(); copyToClipboard(em, `${rowId}-email-list-${idx}`); }} aria-label={`Copier l'adresse email ${em}`} className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] text-earth-700 hover:bg-slate-50 rounded cursor-pointer truncate font-mono">
                                    <span className="truncate">{getLabelForEmail(em, item.decisionMakers)}</span>
                                    {copiedId === `${rowId}-email-list-${idx}` ? <Check className="w-3 h-3 text-emerald-500 shrink-0 ml-2" /> : null}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {item.socials && Object.keys(item.socials).length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {item.socials.facebook && <a href={item.socials.facebook.startsWith('http') ? item.socials.facebook : `https://${item.socials.facebook}`} target="_blank" rel="noopener noreferrer" aria-label="Visiter la page Facebook" className="text-slate-300 hover:text-[#1877F2] transition-colors"><Facebook className="w-3 h-3" /></a>}
                    {item.socials.linkedin && <a href={item.socials.linkedin.startsWith('http') ? item.socials.linkedin : `https://${item.socials.linkedin}`} target="_blank" rel="noopener noreferrer" aria-label="Visiter le profil LinkedIn" className="text-slate-300 hover:text-[#0A66C2] transition-colors"><Linkedin className="w-3 h-3" /></a>}
                </div>
            )}
        </div>

        {/* 9. Actions */}
        <div className="px-4 py-2 text-right h-full overflow-hidden flex flex-col justify-center items-end gap-1.5">
            {item.website && (<a href={item.website} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-1.5 text-slate-600 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-[10px] font-medium shadow-sm hover-lift"><Globe className="w-3 h-3 shrink-0 text-slate-400" /> Web</a>)}
            {item.sourceUri ? (<a href={item.sourceUri} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-1.5 text-white bg-earth-900 hover:bg-black px-2.5 py-1 rounded-md shadow-sm text-[10px] font-medium hover-lift"><MapIcon className="w-3 h-3 shrink-0 text-slate-400" /> Maps</a>) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 bg-white flex flex-col h-[calc(100vh-20rem)] md:h-[650px] animate-fade-in-up">
        {/* Mobile View */}
        <div className="md:hidden p-4 overflow-y-auto">
            {data.map((item, index) => (
                <MobileResultCard key={item.id || index} item={item} index={index} onUpdate={onUpdate} />
            ))}
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex flex-1 flex-col overflow-x-auto">
            <div className="flex flex-col h-full">
                <div className="grid bg-slate-50 text-[10px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200 z-10 shrink-0" style={{ gridTemplateColumns }}>
                    <div className="px-4 py-3 border-r border-slate-200/50">{columnLabels.name}</div>
                    <div className="px-3 py-3 border-r border-slate-200/50 bg-amber-50/50 text-amber-600">{columnLabels.qualityScore}</div>
                    <div className="px-3 py-3 border-r border-slate-200/50">{columnLabels.status}</div>
                    <div className="px-3 py-3 border-r border-slate-200/50">{columnLabels.category}</div>
                    <div className="px-4 py-3 border-r border-slate-200/50">{columnLabels.address}</div>
                    <div className="px-4 py-3 border-r border-slate-200/50">{columnLabels.phone}</div>
                    <div className="px-4 py-3 border-r border-slate-200/50">{columnLabels.hours}</div>
                    <div className="px-4 py-3 border-r border-slate-200/50">{columnLabels.email}</div>
                    <div className="px-4 py-3 text-right">Actions</div>
                </div>
                <div className="flex-1 min-h-0 bg-white">
                    <AutoSizer>
                        {({ height, width }) => (
                            <List className="custom-scrollbar" height={height} itemCount={data.length} itemSize={ROW_HEIGHT} width={width}>
                                {Row}
                            </List>
                        )}
                    </AutoSizer>
                </div>
            </div>
        </div>
        <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 text-right shrink-0 relative z-20 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                 <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                 SERPER_API :: MOTEUR_ANALYTIQUE V2.0 (OPTIMIZED)
            </div>
            <div className="text-[10px] text-slate-400">
                <span className="font-semibold text-slate-500">Astuce :</span> Cliquez sur les champs pour éditer
            </div>
        </div>
    </div>
  );
};

export default React.memo(ResultTable);