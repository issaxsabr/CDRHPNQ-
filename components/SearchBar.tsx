
import React, { useState, useRef } from 'react';
import { Search, MapPin, Database, Zap, Settings, ChevronDown, Sparkles, FileText, Eraser, DollarSign, Map, Folder, FolderPlus, Info, UploadCloud, PieChart, Command, X, Check, FolderOpen, Server, ShieldCheck, Globe } from 'lucide-react';
import { ScraperProvider, CountryCode, SerperStrategy, Project } from '../types';
import Button from './ui/Button';

interface SearchBarProps {
  onSearch: (
      query: string, 
      useLocation: boolean, 
      isBatch: boolean, 
      isSafeMode: boolean, 
      isPaidMode: boolean,
      provider: ScraperProvider,
      serperKey: string,
      country: CountryCode,
      strategy: SerperStrategy,
      startIndex?: number // New param for resuming session
    ) => void;
  isLoading: boolean;
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: (name: string) => void;
  // Quota Management
  quotaLimit?: number;
  quotaUsed?: number;
  onUpdateQuotaLimit?: (limit: number) => void;
  onResetQuota?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
    onSearch, 
    isLoading, 
    projects, 
    activeProjectId, 
    onSelectProject, 
    onCreateProject,
    quotaLimit = 5000,
    quotaUsed = 0,
    onUpdateQuotaLimit,
    onResetQuota
}) => {
  const [mode, setMode] = useState<'simple' | 'batch'>('simple');
  const [query, setQuery] = useState('');
  const [useLocation, setUseLocation] = useState(false);
  
  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const provider: ScraperProvider = 'serper_eco';
  
  const [country, setCountry] = useState<CountryCode>('qc'); // Défaut Québec
  const [strategy, setStrategy] = useState<SerperStrategy>('maps_web_enrich'); // Défaut: Maps + Web pour la qualité
  
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const cleanQuery = mode === 'batch' 
        ? query.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n')
        : query;

    onSearch(
        cleanQuery, 
        useLocation, 
        mode === 'batch', 
        true,
        true, // isPaidMode always true for serper
        provider,
        'SECURE_PROXY', // Clé gérée par le serveur maintenant
        country,
        strategy,
        0
    );
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(newProjectName.trim()) {
          onCreateProject(newProjectName);
          setNewProjectName('');
          setIsCreatingProject(false);
      }
  }

  // --- FILE UPLOAD LOGIC ---
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const processFile = (file: File) => {
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
              setQuery(text);
          }
      };
      reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.txt') || file.name.endsWith('.csv'))) {
          processFile(file);
      } else {
          alert("Format non supporté. Veuillez utiliser un fichier .txt ou .csv");
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
  };

  const loadExample = () => {
      const examples = [
          "Boulangerie Première Moisson Montréal",
          "Garage Michel Tremblay Québec",
          "Restaurant Le Saint-Amour 48 Rue Sainte-Ursule",
          "Clinique Dentaire Laval"
      ];
      setQuery(examples.join('\n'));
  };

  const clearQuery = () => {
      setQuery('');
  };

  const lineCount = query.split('\n').filter(l => l.trim()).length;

  // Configuration des stratégies pour l'affichage
  const strategies = [
    { id: 'maps_basic', name: 'Maps (Std)', cost: 3, icon: Map, desc: 'Recherche Google Maps' },
    { id: 'maps_web_enrich', name: 'Maps + Web', cost: 4, icon: Sparkles, desc: 'Enrichi avec le Web' },
  ];

  const currentStrategy = strategies.find(s => s.id === strategy) || strategies[1];
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Calculation for Quota bar
  const quotaPercent = Math.min((quotaUsed / Math.max(quotaLimit, 1)) * 100, 100);
  const quotaColor = quotaPercent > 90 ? 'bg-rose-500' : quotaPercent > 70 ? 'bg-amber-500' : 'bg-indigo-600';

  return (
    <div className="w-full max-w-4xl mx-auto mb-10 relative z-10 animate-scale-in">
      {/* Top Tabs & Settings Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
            <div id="mode-selector" className="p-1 bg-white border border-slate-200 rounded-lg flex gap-1 shadow-sm" role="tablist">
                <Button 
                    type="button"
                    variant={mode === 'simple' ? 'primary' : 'ghost'}
                    className={mode === 'simple' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}
                    size="sm"
                    onClick={() => setMode('simple')}
                    disabled={isLoading}
                    leftIcon={<Search className="w-3.5 h-3.5" aria-hidden="true" />}
                    rounded="md"
                    role="tab"
                    aria-selected={mode === 'simple'}
                >
                    Simple
                </Button>
                <Button 
                    type="button"
                    variant={mode === 'batch' ? 'primary' : 'ghost'}
                    className={mode === 'batch' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}
                    size="sm"
                    onClick={() => setMode('batch')}
                    disabled={isLoading}
                    leftIcon={<Database className="w-3.5 h-3.5" aria-hidden="true" />}
                    rounded="md"
                    role="tab"
                    aria-selected={mode === 'batch'}
                >
                    Vérifier
                </Button>
            </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
             {/* Project Selector - NOUVEAU DESIGN */}
             <div id="project-selector" className="relative group w-full sm:w-[260px] h-10">
                 {isCreatingProject ? (
                     <div className="absolute inset-0 flex items-center bg-white rounded-lg border-2 border-indigo-500 shadow-md animate-scale-in z-20">
                         <div className="pl-3 pr-2 text-indigo-500"><FolderPlus className="w-4 h-4"/></div>
                         <input 
                            autoFocus
                            type="text" 
                            className="flex-1 min-w-0 py-1 text-sm outline-none placeholder:text-slate-400 text-slate-800 font-medium bg-transparent" 
                            placeholder="Nom du dossier..."
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter') handleCreateProjectSubmit(e);
                                if(e.key === 'Escape') setIsCreatingProject(false);
                            }}
                            aria-label="Nom du nouveau dossier"
                         />
                         <div className="flex items-center border-l border-slate-100 pl-1 ml-1 gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={handleCreateProjectSubmit} title="Créer" aria-label="Confirmer la création"><Check className="w-4 h-4"/></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 hover:bg-rose-50" onClick={() => setIsCreatingProject(false)} title="Annuler" aria-label="Annuler la création"><X className="w-4 h-4"/></Button>
                         </div>
                     </div>
                 ) : (
                    <div className="relative w-full h-full">
                        <select
                            value={activeProjectId || ""}
                            onChange={(e) => {
                                if (e.target.value === 'NEW') setIsCreatingProject(true);
                                else onSelectProject(e.target.value || null);
                            }}
                            className={`w-full h-full appearance-none rounded-lg pl-10 pr-9 text-sm font-medium border cursor-pointer outline-none transition-all shadow-sm ${
                                activeProjectId 
                                ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 hover:border-indigo-300' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                            aria-label="Sélectionner un dossier"
                        >
                            <option value="">(Aucun dossier actif)</option>
                            <option disabled>──────────</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option disabled>──────────</option>
                            <option value="NEW">+ Nouveau Dossier...</option>
                        </select>
                        
                        {/* Custom Icon Layer */}
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {activeProjectId ? (
                                <FolderOpen className="w-4 h-4 text-indigo-600" />
                            ) : (
                                <Folder className="w-4 h-4 text-slate-400" />
                            )}
                        </div>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <ChevronDown className="w-4 h-4" />
                        </div>
                        
                        {/* Item Count Badge (if active) */}
                        {activeProject && (
                            <div className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
                                <span className="bg-white/80 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100 shadow-sm">
                                    {activeProject.itemCount}
                                </span>
                            </div>
                        )}
                    </div>
                 )}
             </div>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            <Button 
                onClick={() => setShowSettings(!showSettings)}
                variant="secondary"
                size="icon"
                className={`w-10 h-10 transition-all duration-200 ${showSettings ? 'bg-slate-100 border-slate-300 shadow-inner' : ''}`}
                aria-label="Ouvrir les paramètres"
                aria-expanded={showSettings}
                aria-controls="settings-panel"
            >
                <Settings className={`w-4 h-4 transition-transform duration-500 ${showSettings ? 'rotate-180 text-indigo-500' : 'group-hover:rotate-90'}`} />
            </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
          <div id="settings-panel" className="mb-6 p-6 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50 animate-fade-in-up">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Command className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                  Configuration
                 </h3>
                 <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                    v1.0
                 </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* LEFT COLUMN: Configuration */}
                  <div className="space-y-5">
                      <div className="space-y-2">
                        <label htmlFor="country-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Globe className="w-3 h-3"/> Province cible</label>
                        <div className="relative">
                            <select 
                                id="country-select"
                                value={country}
                                onChange={(e) => setCountry(e.target.value as CountryCode)}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            >
                                <option value="qc">Québec (QC)</option>
                                <option value="on">Ontario (ON)</option>
                                <option value="bc">Colombie-Britannique (BC)</option>
                                <option value="ab">Alberta (AB)</option>
                                <option value="mb">Manitoba (MB)</option>
                                <option value="sk">Saskatchewan (SK)</option>
                                <option value="nb">Nouveau-Brunswick (NB)</option>
                                <option value="ns">Nouvelle-Écosse (NS)</option>
                                <option value="pe">Île-du-Prince-Édouard (PE)</option>
                                <option value="nl">Terre-Neuve-et-Labrador (NL)</option>
                                <option value="yt">Yukon (YT)</option>
                                <option value="nt">Territoires du Nord-Ouest (NT)</option>
                                <option value="nu">Nunavut (NU)</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Server className="w-3 h-3"/> APIs Connectées</label>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                      <Globe className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                                      Google Serper (Recherche)
                                  </div>
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                      <Check className="w-3 h-3" aria-hidden="true"/> Actif
                                  </span>
                              </div>
                              <div className="w-full h-px bg-slate-200/60"></div>
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                      <Sparkles className="w-3.5 h-3.5 text-violet-500" aria-hidden="true" />
                                      Gemini AI (Analyse)
                                  </div>
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                      <Check className="w-3 h-3" aria-hidden="true"/> Actif
                                  </span>
                              </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                              <span>Clés API sécurisées via Supabase Edge Functions</span>
                          </div>
                      </div>
                  </div>

                  {/* RIGHT COLUMN: Budget Manager */}
                  <div className="flex flex-col justify-end">
                      <div className="p-5 rounded-xl border border-slate-100 bg-slate-50 space-y-4 h-full flex flex-col justify-center">
                         <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm shadow-indigo-200"><PieChart className="w-4 h-4"/></div>
                                <div>
                                    <span className="block text-sm font-bold text-slate-800">Gestion Budget</span>
                                    <span className="block text-[11px] text-slate-500">Crédits Serper consommés</span>
                                </div>
                            </div>
                            <button type="button" className="text-[10px] font-medium text-slate-400 cursor-pointer hover:text-indigo-600 hover:underline px-2" onClick={onResetQuota}>Reset</button>
                         </div>
                         
                         <div className="space-y-3">
                             <div className="flex justify-between items-end text-xs text-slate-600">
                                 <span className="font-medium">Utilisé: <b className="text-lg text-slate-900">{quotaUsed}</b></span>
                                 <span>Plafond: 
                                    <input 
                                        type="number" 
                                        value={quotaLimit} 
                                        onChange={(e) => onUpdateQuotaLimit && onUpdateQuotaLimit(Number(e.target.value))}
                                        className="w-16 bg-white border border-slate-200 rounded px-1 py-0.5 text-right outline-none focus:border-indigo-500 mx-1 text-slate-700"
                                        aria-label="Plafond de quota"
                                    />
                                 </span>
                             </div>
                             <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full ${quotaColor} transition-all duration-700 ease-out`} 
                                    style={{ width: `${quotaPercent}%` }}
                                 ></div>
                             </div>
                             <div className="text-[10px] text-slate-400 text-right">
                                 {Math.max(0, quotaLimit - quotaUsed)} crédits restants
                             </div>
                         </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <form onSubmit={handleSubmit} className="relative" id="search-form" role="search">
        {mode === 'simple' ? (
          <div className="space-y-4">
            {/* Input Bar */}
            <div className={`group relative flex items-center w-full rounded-xl bg-white border shadow-lg shadow-slate-200/50 transition-all focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 ${activeProjectId ? 'border-indigo-200' : 'border-slate-200'}`}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500 group-focus-within:text-indigo-500 transition-colors">
                    <Search className="w-5 h-5" aria-hidden="true" />
                </div>
                <input
                    type="text"
                    className="block w-full py-4 pl-12 pr-4 text-base text-slate-800 bg-transparent border-none focus:ring-0 placeholder-slate-400"
                    placeholder="Recommandé: Nom Entreprise + Adresse Complète"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isLoading}
                    aria-label="Recherche d'entreprise"
                />
                
                <Button 
                    type="button"
                    variant={useLocation ? 'primary' : 'ghost'}
                    size="icon"
                    className={`mx-2 ${useLocation ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-none border-transparent' : 'text-slate-400 hover:bg-slate-50'}`}
                    onClick={() => setUseLocation(!useLocation)}
                    title="Utiliser ma position"
                    aria-label="Utiliser ma position"
                    aria-pressed={useLocation}
                >
                    <MapPin className={`w-5 h-5 ${useLocation ? 'fill-current' : ''}`} aria-hidden="true" />
                </Button>

                <div className="pr-2">
                    <Button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        isLoading={isLoading}
                        size="lg"
                        className={`w-full sm:w-auto ${isLoading || !query.trim() ? 'bg-slate-300 cursor-not-allowed shadow-none' : ''}`}
                        aria-busy={isLoading}
                    >
                        Rechercher
                    </Button>
                </div>
            </div>
            
            {/* Strategy Selector (Shared) */}
            <div id="strategy-selector" className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5" /> 
                            Stratégie
                        </label>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            Coût actuel: {currentStrategy.cost} crédit(s)
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {strategies.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStrategy(s.id as SerperStrategy)}
                                className={`relative flex flex-col items-start p-3 rounded-lg border text-left card-hover ${
                                    strategy === s.id 
                                    ? 'bg-indigo-50/50 border-indigo-200 shadow-sm ring-1 ring-indigo-100' 
                                    : 'bg-white border-slate-100'
                                }`}
                                aria-pressed={strategy === s.id}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <s.icon className={`w-4 h-4 ${strategy === s.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        strategy === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {s.cost} cr.
                                    </span>
                                </div>
                                <div className={`text-xs font-bold mb-0.5 ${strategy === s.id ? 'text-indigo-900' : 'text-slate-700'}`}>{s.name}</div>
                                <div className="text-[10px] text-slate-500 leading-tight">{s.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className={`w-full rounded-xl overflow-hidden border bg-white shadow-xl shadow-slate-200/50 ${activeProjectId ? 'border-indigo-200' : 'border-slate-200'}`}>
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600 flex items-center justify-between gap-2">
               <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold">Input de données (Batch)</span>
               </div>
               <div className="flex items-center gap-2">
                   {/* File Input */}
                   <input 
                      type="file" 
                      accept=".txt,.csv" 
                      ref={fileInputRef} 
                      onChange={handleFileSelect} 
                      className="hidden" 
                      aria-label="Importer un fichier"
                   />
                   <Button 
                    type="button"
                    onClick={triggerFileInput}
                    variant="secondary"
                    size="xs"
                    leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
                    title="Importer un fichier (.txt, .csv)"
                   >
                       <span className="hidden sm:inline">Importer</span>
                   </Button>

                   <Button 
                    type="button"
                    onClick={loadExample}
                    variant="secondary"
                    size="xs"
                    leftIcon={<FileText className="w-3.5 h-3.5" />}
                    title="Charger des données de test"
                   >
                       <span className="hidden sm:inline">Exemple</span>
                   </Button>

                   {query && (
                    <Button 
                        type="button"
                        onClick={clearQuery}
                        variant="danger-light"
                        size="xs"
                        className="px-2"
                        title="Tout effacer"
                        aria-label="Effacer tout"
                    >
                        <Eraser className="w-3.5 h-3.5" />
                    </Button>
                   )}
                   <div className="w-px h-4 bg-slate-300 mx-1"></div>
                   <span className="text-slate-500 font-mono flex items-center gap-1 text-[10px]"><Zap className="w-3 h-3 text-amber-500"/> {country.toUpperCase()}</span>
               </div>
            </div>
            
            {/* DROP ZONE CONTAINER */}
            <div 
                className={`relative transition-all ${isDragging ? 'bg-indigo-50' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragging && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-none animate-in fade-in duration-200">
                        <UploadCloud className="w-10 h-10 text-indigo-500 mb-2 animate-bounce" />
                        <p className="text-sm font-bold text-slate-800">Relâchez pour importer</p>
                    </div>
                )}
                
                <textarea
                className="block w-full p-5 text-sm text-slate-800 bg-transparent border-none focus:ring-0 placeholder-slate-400 min-h-[10rem] md:min-h-[12.5rem] resize-y font-mono leading-relaxed bg-[#FFFFFF] relative z-0"
                placeholder={"Collez votre liste de clients pour mise à jour :\nID123 - Boulangerie Paul Paris\nClient 45 - Garage Michel Bordeaux\n..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
                aria-label="Liste d'entreprises à vérifier (une par ligne)"
                />
            </div>

            {/* FORMAT WARNING BANNER */}
            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs text-amber-800 leading-snug">
                    <span className="font-bold">Conseil qualité :</span> Pour de meilleurs résultats, votre liste doit contenir 
                    <span className="font-bold bg-white border border-amber-200 px-1 rounded mx-1 text-amber-700 shadow-sm">Nom de l'entreprise + Adresse Complète</span> 
                    sur chaque ligne.
                </p>
            </div>
            
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-4">
               
               {/* STRATEGY SELECTOR */}
               <div className="space-y-2">
                   <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                           <DollarSign className="w-3.5 h-3.5" /> 
                           Stratégie
                       </label>
                       {lineCount > 0 && (
                           <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                               Est. Total: ~{lineCount * currentStrategy.cost} crédits
                           </span>
                       )}
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                       {strategies.map((s) => (
                           <button
                               key={s.id}
                               type="button"
                               onClick={() => setStrategy(s.id as SerperStrategy)}
                               className={`relative flex flex-col items-start p-3 rounded-lg border text-left card-hover ${
                                   strategy === s.id 
                                   ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/20' 
                                   : 'bg-slate-100/50 border-slate-200'
                               }`}
                               aria-pressed={strategy === s.id}
                           >
                               <div className="flex items-center justify-between w-full mb-1">
                                   <s.icon className={`w-4 h-4 ${strategy === s.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                       strategy === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                                   }`}>
                                       {s.cost} cr.
                                   </span>
                               </div>
                               <div className={`text-xs font-bold mb-0.5 ${strategy === s.id ? 'text-slate-900' : 'text-slate-600'}`}>{s.name}</div>
                               <div className="text-[10px] text-slate-500 leading-tight">{s.desc}</div>
                           </button>
                       ))}
                   </div>
               </div>

               <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 mt-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${lineCount > 0 ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></div>
                            <span className="text-xs font-medium text-slate-500">
                                {lineCount} entreprises à analyser
                            </span>
                        </div>
                        {activeProjectId && (
                            <span className="text-[10px] font-medium text-indigo-600 flex items-center gap-1">
                                <Folder className="w-3 h-3" />
                                Enregistrement dans : <b>{activeProject?.name}</b>
                            </span>
                        )}
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        isLoading={isLoading}
                        className={isLoading || !query.trim() ? 'bg-slate-300 cursor-not-allowed shadow-none' : ''}
                        aria-busy={isLoading}
                    >
                        Lancer la Vérification
                    </Button>
               </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default React.memo(SearchBar);
