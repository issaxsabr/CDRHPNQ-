
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Info, StopCircle, Clock, Zap, Sparkles, Filter, Check, PlayCircle, X, FileJson, AlertOctagon, RotateCw, HardDrive, TableProperties, FileCode, FileSpreadsheet, Loader2 } from 'lucide-react';
import SearchBar from './components/SearchBar';
import ResultTable from './components/ResultTable';
import AuthOverlay from './components/AuthOverlay';
import Header from './components/Header';
import DashboardStats from './components/DashboardStats';
import ProjectModal from './components/modals/ProjectModal';
import ColumnConfigModal from './components/modals/ColumnConfigModal';
import CacheModal from './components/modals/CacheModal';

import { supabase } from './services/supabase';
import { extractDataFromContext, enrichWithGemini } from './services/gemini';
import { searchWithSerper } from './services/serper';
import { cacheService, projectService, blacklistService, globalIndexService } from './services/storage';
import { BusinessData, ScraperState, ScraperProvider, CountryCode, SavedSession, SerperStrategy, Project, ColumnLabelMap } from './types';
import { getInteractiveHTMLContent, createExcelWorkbook, exportToExcel } from './utils/exportUtils';

// Hooks
import { useProjects } from './hooks/useProjects';
import { useAutoSave } from './hooks/useAutoSave';
import { useQuota } from './hooks/useQuota';


const SESSION_KEY = 'mapscraper_active_session_v1';
const BATCH_CONCURRENCY = 3; // Nombre de requêtes en parallèle (Mode Turbo)
const BATCH_DELAY_MS = 1000; // Délai entre chaque lot pour éviter le rate-limit

// COÛTS SERPER
const COSTS = {
    web_basic: 1,
    maps_basic: 3,
    maps_web_enrich: 4
};

const DEFAULT_LABELS: ColumnLabelMap = {
    name: "Entreprise",
    status: "Statut",
    customField: "Memo", 
    category: "Catégorie",
    address: "Adresse",
    phone: "Tél.",
    hours: "Horaires",
    email: "Lead Contact"
};

const mergeNewResults = (currentResults: BusinessData[], newResults: BusinessData[]): BusinessData[] => {
  const updatedList = [...currentResults];

  newResults.forEach(newItem => {
    const existingIndex = updatedList.findIndex(item =>
       (newItem.searchedTerm && item.searchedTerm && item.searchedTerm === newItem.searchedTerm) ||
       (item.name === newItem.name && item.address === newItem.address)
    );

    if (existingIndex >= 0) {
      const existing = updatedList[existingIndex];
      updatedList[existingIndex] = {
        ...existing,
        status: (existing.status === 'Introuvable' || existing.status === 'Erreur' || existing.status === 'Non trouvé') ? newItem.status : existing.status,
        address: (existing.address && existing.address !== 'N/A') ? existing.address : newItem.address,
        hours: (existing.hours && existing.hours !== 'N/A') ? existing.hours : newItem.hours,
        website: existing.website || newItem.website,
        email: existing.email || newItem.email,
        category: existing.category || newItem.category,
        sourceUri: existing.sourceUri || newItem.sourceUri,
        phones: Array.from(new Set([...(existing.phones || []), ...(newItem.phones || [])])),
        emails: Array.from(new Set([...(existing.emails || []), ...(newItem.emails || [])])),
        socials: { ...existing.socials, ...newItem.socials },
        phone: (existing.phone && existing.phone !== 'N/A') ? existing.phone : newItem.phone,
        decisionMakers: (newItem.decisionMakers && newItem.decisionMakers.length > 0) ? newItem.decisionMakers : existing.decisionMakers,
        customField: existing.customField || newItem.customField
      };
    } else {
      updatedList.push(newItem);
    }
  });

  return updatedList;
};

const App: React.FC = () => {
  const [state, setState] = useState<ScraperState>({
    isLoading: false,
    isBatchMode: false,
    progress: { current: 0, total: 0 },
    results: [],
    error: null,
    rawText: null,
  });

  // Auth State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Column Customization
  const [columnLabels, setColumnLabels] = useState<ColumnLabelMap>(DEFAULT_LABELS);
  const [showColumnModal, setShowColumnModal] = useState(false);
  
  // Custom Hooks
  const { quotaLimit, quotaUsed, updateQuotaUsed, handleUpdateQuotaLimit, handleResetQuota } = useQuota(5000);
  const { projects, activeProjectId, setActiveProjectId, loadProjects, handleCreateProject, handleDeleteProject, handleSelectProject } = useProjects();
  const { dirHandle, setDirHandle, hasStoredHandle, lastAutoSave, performAutoSave, restoreFolderConnection, handleConnectLocalFolder } = useAutoSave(activeProjectId, projects, columnLabels);


  // Project Management
  const [showProjectModal, setShowProjectModal] = useState(false);

  const [historyCount, setHistoryCount] = useState(0);
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);

  const [showCacheModal, setShowCacheModal] = useState(false);
  const [cachedItems, setCachedItems] = useState<{term: string, data: BusinessData, timestamp: number}[]>([]);
  const [selectedCacheKeys, setSelectedCacheKeys] = useState<Set<string>>(new Set());

  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string | null>(null);
  const stopRef = React.useRef(false);

  const [exportFilters, setExportFilters] = useState({
    excludeClosed: false,
    excludeNoPhone: false,
    excludeDuplicates: false, onlyWithEmail: false
  });

  useEffect(() => {
    // 1. Initial Data Load
    checkActiveSession();
    refreshHistoryCount();
    
    const savedLabels = localStorage.getItem('mapscraper_column_labels');
    if (savedLabels) {
        try {
            setColumnLabels(JSON.parse(savedLabels));
        } catch(e) { console.error("Failed to parse column labels from localStorage", e); }
    }

    // 2. Auth Check
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setAuthLoading(false);
    });

    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
      await supabase.auth.signOut();
  };

  const saveColumnLabels = (newLabels: ColumnLabelMap) => {
      setColumnLabels(newLabels);
      localStorage.setItem('mapscraper_column_labels', JSON.stringify(newLabels));
  };
  
  const selectProjectAndLoadContent = async (id: string | null) => {
      const content = await handleSelectProject(id);
      if (content) {
          setState(prev => ({
              ...prev,
              results: content,
              isBatchMode: false,
              isLoading: false,
              progress: { current: 0, total: 0 }
          }));
      } else if (id === null) {
          setState(prev => ({ ...prev, results: [] }));
      }
  };

  const generateInteractiveHTML = (data: BusinessData[], projectName: string) => {
      const htmlContent = getInteractiveHTMLContent(data, projectName, columnLabels);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `app_${projectName.replace(/\s+/g, '_')}.html`;
      link.click();
  };

  // --- EXPORT LOGIC ---
  const handleExportProject = async (e: React.MouseEvent, project: Project, type: 'xlsx' | 'json' | 'html') => {
    e.stopPropagation(); 
    try {
        const data = await projectService.getProjectContent(project.id);
        if (!data || data.length === 0) {
            alert("Ce projet est vide.");
            return;
        }

        const fileName = `export_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

        if (type === 'xlsx') {
            exportToExcel(data, fileName, columnLabels);
        } else if (type === 'html') {
            generateInteractiveHTML(data, project.name);
        } else {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${fileName}.json`;
            link.click();
        }

    } catch (err) {
        console.error("Erreur lors de l'export du projet", err);
        alert("Erreur lors de la génération du fichier.");
    }
  };

  const checkActiveSession = () => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const sessionData: SavedSession = JSON.parse(saved);
        if (sessionData.query && sessionData.results.length < sessionData.query.split('\n').filter(l => l.trim()).length) {
            setActiveSession(sessionData);
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (e) {
      console.warn("Error reading active session", e);
    }
  };

  const resumeSession = () => {
    if (!activeSession) return;
    setState(prev => ({
        ...prev,
        results: activeSession.results,
        progress: { current: activeSession.currentIndex, total: activeSession.query.split('\n').filter(l => l.trim()).length }
    }));

    handleSearch(
        activeSession.query,
        false,
        true,
        true,
        activeSession.config.isPaidMode,
        'serper_eco',
        activeSession.config.serperKey,
        activeSession.config.country,
        activeSession.config.strategy,
        activeSession.currentIndex
    );
    setActiveSession(null);
  };

  const discardSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setActiveSession(null);
  };

  const saveSession = (query: string, currentIndex: number, results: BusinessData[], config: SavedSession['config']) => {
      try {
          const sessionData: SavedSession = {
              query,
              currentIndex,
              results,
              timestamp: Date.now(),
              config
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      } catch (e) {
          console.warn("Failed to save session", e);
      }
  };

  const refreshHistoryCount = async () => {
    const count = await cacheService.count();
    setHistoryCount(count);
  };

  const openCacheModal = async () => {
    const items = await cacheService.getAll();
    setCachedItems(items);
    setSelectedCacheKeys(new Set());
    setShowCacheModal(true);
  };

  const handleClearCache = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir vider tout le cache local ?")) {
        await cacheService.clear();
        setCachedItems([]);
        setSelectedCacheKeys(new Set());
        await refreshHistoryCount();
        setShowCacheModal(false);
    }
  };

  const toggleSelectCacheItem = (term: string) => {
    const newSet = new Set(selectedCacheKeys);
    if (newSet.has(term)) { newSet.delete(term); } else { newSet.add(term); }
    setSelectedCacheKeys(newSet);
  };

  const toggleSelectAllCache = () => {
      if (selectedCacheKeys.size === cachedItems.length) {
          setSelectedCacheKeys(new Set());
      } else {
          setSelectedCacheKeys(new Set(cachedItems.map(i => i.term)));
      }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Estimation du temps restant avec le mode parallèle
  const formatTimeLeft = (remainingItems: number) => {
    // On estime : (Nb d'items / Concurrency) * (Delay + TempsMoyenRequete)
    const batchesRemaining = Math.ceil(remainingItems / BATCH_CONCURRENCY);
    const avgReqTime = 2000; // Estimation 2s par batch
    const totalSeconds = Math.ceil((batchesRemaining * (BATCH_DELAY_MS + avgReqTime)) / 1000);
    
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}m ${totalSeconds % 60}s`;
  };

  // Nouvelle fonction pour éditer les cellules
  const handleUpdateResult = (index: number, field: keyof BusinessData, value: any) => {
    setState(prev => {
        const newResults = [...prev.results];
        // Gestion spéciale pour synchroniser les listes (emails/phones) avec le champ principal
        if (field === 'phone') {
             newResults[index] = { ...newResults[index], phone: value };
             const oldPhones = newResults[index].phones || [];
             if (oldPhones.length > 0) oldPhones[0] = value;
             else newResults[index].phones = [value];
        }
        else if (field === 'email') {
             newResults[index] = { ...newResults[index], email: value };
             const oldEmails = newResults[index].emails || [];
             if (oldEmails.length > 0) oldEmails[0] = value;
             else newResults[index].emails = [value];
        }
        else {
            newResults[index] = { ...newResults[index], [field]: value };
        }

        // PERSISTENCE : Si on est dans un projet, on sauvegarde immédiatement
        if (activeProjectId) {
             projectService.updateProjectContent(activeProjectId, newResults);
        }

        return { ...prev, results: newResults };
    });
  };

  const processSingleQuery = async (
      query: string, 
      provider: ScraperProvider, 
      serperKey: string,
      country: string,
      strategy: SerperStrategy
  ): Promise<{ businesses: BusinessData[], rawText: string }> => {
      const serperData = await searchWithSerper(query, serperKey, country, strategy);
      const geminiEnrichmentData = await enrichWithGemini(serperData, query);
      return await extractDataFromContext(query, serperData, geminiEnrichmentData);
  };

  const handleSearch = useCallback(async (
      query: string, 
      useLocation: boolean, 
      isBatch: boolean, 
      isSafeMode: boolean, 
      isPaidMode: boolean,
      provider: ScraperProvider,
      serperKey: string,
      country: CountryCode,
      strategy: SerperStrategy,
      startIndex: number = 0
  ) => {
    stopRef.current = false;
    setEstimatedTimeLeft(null);
    setActiveSession(null);
    setExportFilters({ excludeClosed: false, excludeNoPhone: false, excludeDuplicates: false, onlyWithEmail: false });
    
    const costPerQuery = COSTS[strategy] || 3;

    if (!isBatch) {
      // --- SINGLE MODE ---
      const cached = await cacheService.get(query);
      if (cached) {
          const newResult = { ...cached, status: cached.status + " (Cache)" };
          setState(prev => {
            if (stopRef.current) return prev; 
            const updated = mergeNewResults(prev.results, [newResult]);
            return {
                ...prev,
                isLoading: false,
                results: updated,
                error: null
            };
          });
          if (activeProjectId) {
              await projectService.addResultsToProject(activeProjectId, [newResult]);
              await loadProjects(); 
              await performAutoSave();
          }
          return;
      }

      setState(prev => ({ ...prev, isLoading: true, isBatchMode: false, error: null, rawText: null }));
      
      try {
        if (stopRef.current) return;
        
        updateQuotaUsed(costPerQuery);

        const { businesses, rawText } = await processSingleQuery(query, provider, serperKey, country, strategy);
        if (stopRef.current) return;

        if (businesses.length > 0) {
            let item = businesses[0];
            
            const blCheck = blacklistService.isBlacklisted(item);
            if (blCheck.isBlacklisted) {
                item = { ...item, status: `Ignoré: ${blCheck.reason}`, email: undefined, phone: undefined };
            } else if (activeProjectId) {
                const dupCheck = await globalIndexService.checkDuplicate(item);
                if (dupCheck.isDuplicate && dupCheck.projectId !== activeProjectId) {
                     const projName = await projectService.getProjectName(dupCheck.projectId || '');
                     item = { ...item, status: `Doublon (Dossier: ${projName})` };
                }
            }

            await cacheService.set(query, item);
            refreshHistoryCount();
            
            if (activeProjectId && !blCheck.isBlacklisted) {
                await projectService.addResultsToProject(activeProjectId, [item]);
                await loadProjects();
                await performAutoSave();
            }
            
            setState(prev => ({
                ...prev,
                isLoading: false,
                results: mergeNewResults(prev.results, [item]),
                rawText: rawText
            }));
        } else {
             setState(prev => ({ ...prev, isLoading: false, results: prev.results, rawText: "Aucun résultat" }));
        }

      } catch (err: any) {
        if (stopRef.current) return;
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err.message || "Erreur lors de la récupération."
        }));
      }

    } else {
      // --- TURBO BATCH MODE ---
      const lines = query.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;

      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        isBatchMode: true,
        progress: { current: startIndex, total: lines.length },
        error: null, 
        rawText: null 
      }));

      for (let i = startIndex; i < lines.length; i += BATCH_CONCURRENCY) {
        if (stopRef.current) break;
        
        const chunk = lines.slice(i, i + BATCH_CONCURRENCY);
        setEstimatedTimeLeft(formatTimeLeft(lines.length - i));
        
        const promises = chunk.map(async (line) => {
            const cached = await cacheService.get(line);
            if (cached) {
                return { success: true, data: { ...cached, searchedTerm: line }, fromCache: true };
            }

            try {
                const { businesses } = await processSingleQuery(line, provider, serperKey, country, strategy);
                return { success: true, data: businesses[0], fromCache: false };
            } catch (e: any) {
                return { 
                    success: false, 
                    data: { name: line, status: "Erreur", address: e.message || "Erreur technique", phone: "", hours: "", searchedTerm: line } as BusinessData 
                };
            }
        });

        const batchResults = await Promise.all(promises);
        if (stopRef.current) break;
        
        const realApiCallCount = batchResults.filter(r => !r.fromCache && r.success).length;
        if (realApiCallCount > 0) {
            updateQuotaUsed(realApiCallCount * costPerQuery);
        }

        const validResultsToAdd: BusinessData[] = [];
        const resultsToDisplay: BusinessData[] = [];
        
        for (const res of batchResults) {
            if (res.success && res.data) {
                let item = res.data;
                let saveToProject = true;

                const blCheck = blacklistService.isBlacklisted(item);
                if (blCheck.isBlacklisted) {
                    item = { ...item, status: `Ignoré (Blacklist)`, email: undefined, phone: undefined };
                    saveToProject = false;
                }

                if (saveToProject && activeProjectId) {
                     const dupCheck = await globalIndexService.checkDuplicate(item);
                     if (dupCheck.isDuplicate && dupCheck.projectId !== activeProjectId) {
                         const projName = await projectService.getProjectName(dupCheck.projectId || '');
                         item = { ...item, status: `Doublon (Dossier: ${projName})` };
                     }
                }
                
                resultsToDisplay.push(item);

                if (saveToProject) {
                    validResultsToAdd.push(item);
                    if (!res.fromCache) {
                        await cacheService.set(item.searchedTerm || item.name, item);
                    }
                }
            } else if (!res.success && res.data) {
                 resultsToDisplay.push(res.data);
            }
        }

        if (validResultsToAdd.length > 0) {
             await refreshHistoryCount();
             
             if (activeProjectId) {
                 await projectService.addResultsToProject(activeProjectId, validResultsToAdd);
             }
        }
        
        setState(prev => {
            if (stopRef.current) return prev;
            const newResults = mergeNewResults(prev.results, resultsToDisplay);
            const nextIndex = Math.min(i + BATCH_CONCURRENCY, lines.length);
            saveSession(query, nextIndex, newResults, { isPaidMode, serperKey, country, strategy });
            return { 
                ...prev, 
                progress: { current: nextIndex, total: lines.length }, 
                results: newResults 
            };
        });
             
        if (activeProjectId) await loadProjects();

        if (i + BATCH_CONCURRENCY < lines.length) {
            await delay(BATCH_DELAY_MS);
        }
      }

      if (activeProjectId) {
           await performAutoSave();
      }

      if (!stopRef.current) {
          localStorage.removeItem(SESSION_KEY);
      }
      if (activeProjectId) await loadProjects();
      setState(prev => ({ ...prev, isLoading: false }));
      setEstimatedTimeLeft(null);
    }
  }, [activeProjectId, state.results, projects, columnLabels]); 


  const handleStop = () => { stopRef.current = true; setState(prev => ({ ...prev, isLoading: false })); };
  const handleClearResults = () => { stopRef.current = true; setState({ isLoading: false, isBatchMode: false, progress: { current: 0, total: 0 }, results: [], error: null, rawText: null }); setActiveProjectId(null); setDirHandle(null); };

  const getFilteredData = () => {
    let dataToExport = [...state.results];
    if (exportFilters.excludeClosed) {
        dataToExport = dataToExport.filter(r => {
             const s = r.status?.toLowerCase() || "";
             return !s.includes('fermé') && !s.includes('closed') && !s.includes('définitiv');
        });
    }
    if (exportFilters.excludeNoPhone) dataToExport = dataToExport.filter(r => r.phone && r.phone !== 'N/A' && r.phone.trim() !== '');
    if (exportFilters.onlyWithEmail) dataToExport = dataToExport.filter(r => r.email && r.email.trim() !== '');
    if (exportFilters.excludeDuplicates) {
        const seen = new Set();
        dataToExport = dataToExport.filter(r => {
             const key = (r.name + (r.address || '').substring(0, 10)).toLowerCase().trim();
             if (seen.has(key)) return false;
             seen.add(key);
             return true;
        });
    }
    return dataToExport;
  };

  const downloadExcel = () => {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) { alert("Aucune donnée à exporter."); return; }
    const fileName = `lead_harvest_${activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : 'temp'}_${new Date().toISOString().slice(0, 10)}`;
    exportToExcel(dataToExport, fileName, columnLabels);
  };
  
  const downloadJSON = () => {
    const dataToExport = getFilteredData();
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lead_harvest_${activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : 'temp'}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const downloadHTML = () => {
      const dataToExport = getFilteredData();
      const projName = activeProjectId ? projects.find(p => p.id === activeProjectId)?.name || 'Projet' : 'Session Temporaire';
      generateInteractiveHTML(dataToExport, projName);
  };

  const stats = {
      total: state.results.length,
      emails: state.results.filter(r => r.email).length,
      phones: state.results.filter(r => r.phone && r.phone !== 'N/A').length,
  };

  const toggleDashboardFilter = (type: 'email' | 'phone') => {
      if (type === 'email') setExportFilters(prev => ({ ...prev, onlyWithEmail: !prev.onlyWithEmail }));
      if (type === 'phone') setExportFilters(prev => ({ ...prev, excludeNoPhone: !prev.excludeNoPhone }));
  };

  if (authLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-slate-500 font-medium">Initialisation du système...</span>
        </div>
      );
  }

  if (!session) {
      return (
        <div className="relative min-h-screen">
             <div className="absolute inset-0 bg-slate-100 blur-sm z-0"></div>
             <AuthOverlay onLoginSuccess={() => setAuthLoading(false)} />
        </div>
      );
  }

  return (
    <div className="min-h-screen font-sans text-slate-800">
      
      <Header 
        projectCount={projects.length}
        historyCount={historyCount}
        onLogout={handleLogout}
        onOpenProjectModal={() => setShowProjectModal(true)}
        onOpenCacheModal={openCacheModal}
      />

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 relative z-10">
        
        {activeSession && !state.isLoading && (
            <div className="mb-8 p-4 rounded-xl bg-white border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 shadow-lg shadow-indigo-100/50">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><PlayCircle className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Session précédente détectée</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Reprendre là où vous vous êtes arrêté ?</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button onClick={discardSession} className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Ignorer</button>
                    <button onClick={resumeSession} className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"><Zap className="w-3.5 h-3.5" /> Reprendre</button>
                </div>
            </div>
        )}

        <div className="text-center mb-12 animate-in fade-in zoom-in-95 duration-700">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Sparkles className="w-3 h-3" />
            Vérification Instantanée
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Statut d'entreprise
          </h2>
        </div>

        <SearchBar 
            onSearch={handleSearch} 
            isLoading={state.isLoading} 
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={selectProjectAndLoadContent}
            onCreateProject={handleCreateProject}
            quotaLimit={quotaLimit}
            quotaUsed={quotaUsed}
            onUpdateQuotaLimit={handleUpdateQuotaLimit}
            onResetQuota={handleResetQuota}
        />

        {state.isBatchMode && (state.isLoading || state.progress.current > 0) && (
          <div className="max-w-4xl mx-auto mb-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xl flex flex-col gap-4 animate-in slide-in-from-bottom-4">
             <div className="flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">Traitement du lot en cours</span>
                    <span className="text-xs text-slate-500">Ligne {state.progress.current} sur {state.progress.total}</span>
                 </div>
                 {estimatedTimeLeft && <span className="hidden sm:flex text-xs items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 font-mono"><Clock className="w-3.5 h-3.5" /> ~ {estimatedTimeLeft}</span>}
               </div>
               {state.isLoading && <button onClick={handleStop} className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 border border-rose-200 rounded-lg px-3 py-1.5 bg-rose-50 hover:bg-rose-100 transition-colors"><StopCircle className="w-3.5 h-3.5" /> Arrêter</button>}
             </div>
             <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
               <div className="h-2 rounded-full transition-all duration-500 ease-out relative bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(state.progress.current / state.progress.total) * 100}%` }}></div>
             </div>
          </div>
        )}

        {state.error && (
          <div className="max-w-4xl mx-auto mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center gap-3 animate-in fade-in">
            <AlertOctagon className="w-5 h-5" /> <span>{state.error}</span>
          </div>
        )}

        {(state.results.length > 0 || activeProjectId) && (
          <div className="space-y-6">
            
            <DashboardStats 
                stats={stats}
                exportFilters={exportFilters}
                onToggleFilter={toggleDashboardFilter}
            />

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-2 mb-4 animate-in slide-in-from-bottom-8 delay-100 duration-500">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 bg-slate-900 text-white rounded-full text-xs font-bold shadow-md">{getFilteredData().length}</span>
                  Résultats {activeProjectId ? '(Sauvegardé)' : '(Temp)'}
                </h3>
                {activeProjectId && (
                    <div className="flex items-center gap-2">
                         {!dirHandle ? (
                            hasStoredHandle ? (
                                <button 
                                    onClick={restoreFolderConnection} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm hover:bg-indigo-100 transition-colors animate-pulse"
                                    title="Restaurer l'accès au dossier local pour ce projet"
                                >
                                    <RotateCw className="w-3 h-3" />
                                    <span className="hidden sm:inline">Reconnecter Dossier</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={handleConnectLocalFolder} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                                    title="Lier un dossier local à ce projet pour la sauvegarde auto"
                                >
                                    <HardDrive className="w-3 h-3" />
                                    <span className="hidden sm:inline">Connecter Dossier Local</span>
                                </button>
                            )
                         ) : (
                             <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm" title="Sauvegarde active toutes les 5 minutes">
                                <Check className="w-3 h-3" />
                                <span className="hidden sm:inline">Sauvegarde Auto Active</span>
                                {lastAutoSave && <span className="text-emerald-400 font-normal ml-1">({new Date(lastAutoSave).toLocaleTimeString()})</span>}
                             </div>
                         )}
                    </div>
                )}
                <button onClick={handleClearResults} title="Fermer la vue" className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full xl:w-auto">
                <button onClick={() => setShowColumnModal(true)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                    <TableProperties className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Colonnes</span>
                </button>

                <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1"></div>

                <div className="flex items-center gap-2 px-3 text-xs font-medium text-slate-500 border-r border-slate-100 pr-4 mr-1 hidden sm:flex"><Filter className="w-3.5 h-3.5" /><span>Filtres :</span></div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setExportFilters(prev => ({ ...prev, excludeClosed: !prev.excludeClosed }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${exportFilters.excludeClosed ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-slate-300'}`}>{exportFilters.excludeClosed ? <Check className="w-3 h-3" /> : <div className="w-3 h-3" />}Actifs</button>
                    <button onClick={() => setExportFilters(prev => ({ ...prev, excludeNoPhone: !prev.excludeNoPhone }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${exportFilters.excludeNoPhone ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-slate-300'}`}>{exportFilters.excludeNoPhone ? <Check className="w-3 h-3" /> : <div className="w-3 h-3" />}Avec Tél</button>
                    <button onClick={() => setExportFilters(prev => ({ ...prev, onlyWithEmail: !prev.onlyWithEmail }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${exportFilters.onlyWithEmail ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-slate-300'}`}>{exportFilters.onlyWithEmail ? <Check className="w-3 h-3" /> : <div className="w-3 h-3" />}Avec Email</button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={downloadHTML} className="group flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-white rounded-lg transition-all border border-slate-200 shadow-sm" title="Télécharger Mini-App HTML autonome"><FileCode className="w-3.5 h-3.5" /></button>
                    <button onClick={downloadJSON} className="group flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-white rounded-lg transition-all border border-slate-200 shadow-sm" title="Télécharger JSON"><FileJson className="w-3.5 h-3.5" /></button>
                    <button onClick={downloadExcel} className="group flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-md active:scale-95 whitespace-nowrap"><FileSpreadsheet className="w-3.5 h-3.5 group-hover:animate-bounce" /> Excel</button>
                </div>
              </div>
            </div>

            <ResultTable 
                data={getFilteredData()} 
                onUpdate={handleUpdateResult} 
                columnLabels={columnLabels}
            />

            <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 flex items-start gap-3 max-w-2xl mx-auto shadow-sm animate-in fade-in delay-300">
               <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
               <div className="space-y-1">
                 <p>Les données sont enregistrées automatiquement en local. Aucune donnée ne transite vers nos serveurs.</p>
               </div>
            </div>
          </div>
        )}

        <ProjectModal 
            isOpen={showProjectModal}
            onClose={() => setShowProjectModal(false)}
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={selectProjectAndLoadContent}
            onDeleteProject={handleDeleteProject}
            onExportProject={handleExportProject}
        />

        <ColumnConfigModal 
            isOpen={showColumnModal}
            onClose={() => setShowColumnModal(false)}
            columnLabels={columnLabels}
            onSaveColumnLabels={saveColumnLabels}
        />

        <CacheModal 
            isOpen={showCacheModal}
            onClose={() => setShowCacheModal(false)}
            cachedItems={cachedItems}
            selectedCacheKeys={selectedCacheKeys}
            onClearCache={handleClearCache}
            onToggleSelectCacheItem={toggleSelectCacheItem}
            onToggleSelectAllCache={toggleSelectAllCache}
        />
        
      </main>
    </div>
  );
};

export default App;
