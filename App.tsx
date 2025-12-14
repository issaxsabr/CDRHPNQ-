
import React, { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { Session } from '@supabase/supabase-js';
import { Info, StopCircle, Clock, Zap, Sparkles, Filter, Check, PlayCircle, X, FileJson, AlertOctagon, RotateCw, HardDrive, TableProperties, FileCode, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import SearchBar from './components/SearchBar';
import ResultTable from './components/ResultTable';
import AuthOverlay from './components/AuthOverlay';
import Header from './components/Header';
import DashboardStats from './components/DashboardStats';
import { ToastProvider, useToast } from './contexts/ToastContext';

import { supabase } from './services/supabase';
import { extractDataFromContext, enrichWithGemini } from './services/gemini';
import { searchWithSerper } from './services/serper';
import { cacheService, projectService, blacklistService, globalIndexService } from './services/storage';
import { BusinessData, ScraperState, ScraperProvider, CountryCode, SavedSession, SerperStrategy, Project, ColumnLabelMap } from './types';
import { getInteractiveHTMLContent, createExcelWorkbook, exportToExcel } from './utils/exportUtils';
import { CONFIG } from './config';

// Hooks
import { useProjects } from './hooks/useProjects';
import { useAutoSave } from './hooks/useAutoSave';
import { useQuota } from './hooks/useQuota';
import { TimelineStep } from './components/Timeline';

// Lazy load modals for code splitting
const ProjectModal = lazy(() => import('./components/modals/ProjectModal'));
const ColumnConfigModal = lazy(() => import('./components/modals/ColumnConfigModal'));
const CacheModal = lazy(() => import('./components/modals/CacheModal'));
const LoadingScreen = lazy(() => import('./components/LoadingScreen'));
const BatchProgress = lazy(() => import('./components/BatchProgress'));


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

const AppContent: React.FC = () => {
  const { addToast } = useToast();
  const [state, setState] = useState<ScraperState>({
    isLoading: false,
    isBatchMode: false,
    progress: { current: 0, total: 0 },
    results: [],
    error: null,
    rawText: null,
  });
  
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);

  // Auth State (FIX: Replaced 'any' with Supabase 'Session' type)
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Column Customization
  const [columnLabels, setColumnLabels] = useState<ColumnLabelMap>(DEFAULT_LABELS);
  const [showColumnModal, setShowColumnModal] = useState(false);
  
  // Custom Hooks
  const { quotaLimit, quotaUsed, updateQuotaUsed, handleUpdateQuotaLimit, handleResetQuota } = useQuota(5000);
  const { projects, activeProjectId, setActiveProjectId, loadProjects, handleCreateProject, handleDeleteProject, handleSelectProject } = useProjects();
  const { dirHandle, setDirHandle, hasStoredHandle, lastAutoSave, performAutoSave, restoreFolderConnection, handleConnectLocalFolder } = useAutoSave(activeProjectId, projects, columnLabels, addToast);

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
    checkActiveSession();
    refreshHistoryCount();
    
    const savedLabels = localStorage.getItem('mapscraper_column_labels');
    if (savedLabels) {
        try {
            setColumnLabels(JSON.parse(savedLabels));
        } catch(e) { console.error("Failed to parse column labels from localStorage", e); }
    }

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
  
  const selectProjectAndLoadContent = useCallback(async (id: string | null) => {
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
  }, [handleSelectProject]);

  const generateInteractiveHTML = useCallback((data: BusinessData[], projectName: string) => {
      const htmlContent = getInteractiveHTMLContent(data, projectName, columnLabels);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `app_${projectName.replace(/\s+/g, '_')}.html`;
      link.click();
      addToast({type: 'success', title: "HTML App Exportée", message: "Le fichier interactif a été téléchargé."});
  }, [columnLabels, addToast]);

  const handleExportProject = useCallback(async (e: React.MouseEvent, project: Project, type: 'xlsx' | 'json' | 'html') => {
    e.stopPropagation(); 
    try {
        const data = await projectService.getProjectContent(project.id);
        if (!data || data.length === 0) {
            addToast({type: 'info', title: 'Dossier Vide', message: `Le dossier "${project.name}" ne contient aucune donnée à exporter.`});
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
        addToast({type: 'success', title: 'Exportation Réussie', message: `Le dossier "${project.name}" a été exporté en ${type.toUpperCase()}.`});
    } catch (err: any) {
        console.error("Erreur lors de l'export du projet", err);
        addToast({type: 'error', title: "Erreur d'Exportation", message: err.message || "Impossible de générer le fichier."});
    }
  }, [columnLabels, generateInteractiveHTML, addToast]);

  const checkActiveSession = () => {
    try {
      const saved = localStorage.getItem(CONFIG.SESSION_KEY);
      if (saved) {
        const sessionData: SavedSession = JSON.parse(saved);
        if (sessionData.query && sessionData.results.length < sessionData.query.split('\n').filter(l => l.trim()).length) {
            setActiveSession(sessionData);
        } else {
            localStorage.removeItem(CONFIG.SESSION_KEY);
        }
      }
    } catch (e) {
      console.warn("Error reading active session", e);
    }
  };

  const saveSession = useCallback((query: string, currentIndex: number, results: BusinessData[], config: SavedSession['config']) => {
      try {
          const sessionData: SavedSession = {
              query,
              currentIndex,
              results,
              timestamp: Date.now(),
              config
          };
          localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
      } catch (e) {
          console.warn("Failed to save session", e);
      }
  }, []);

  const discardSession = () => {
    localStorage.removeItem(CONFIG.SESSION_KEY);
    setActiveSession(null);
  };

  const refreshHistoryCount = useCallback(async () => {
    const count = await cacheService.count();
    setHistoryCount(count);
  }, []);

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
        addToast({type: 'success', title: 'Cache Vierge', message: 'Toutes les données en cache ont été supprimées.'});
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

  const formatTimeLeft = (remainingItems: number) => {
    const batchesRemaining = Math.ceil(remainingItems / CONFIG.BATCH_CONCURRENCY);
    const avgReqTime = 2000;
    const totalSeconds = Math.ceil((batchesRemaining * (CONFIG.BATCH_DELAY_MS + avgReqTime)) / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}m ${totalSeconds % 60}s`;
  };

  const handleUpdateResult = useCallback((index: number, field: keyof BusinessData, value: any) => {
    setState(prev => {
        const newResults = [...prev.results];
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

        if (activeProjectId) {
             projectService.updateProjectContent(activeProjectId, newResults);
        }

        return { ...prev, results: newResults };
    });
  }, [activeProjectId]);

  const processSingleQuery = async (
      query: string, provider: ScraperProvider, serperKey: string, country: string, strategy: SerperStrategy
  ): Promise<{ businesses: BusinessData[], rawText: string }> => {
      const serperData = await searchWithSerper(query, serperKey, country, strategy);
      const geminiEnrichmentData = await enrichWithGemini(serperData, query);
      return await extractDataFromContext(query, serperData, geminiEnrichmentData);
  };
  
  // OPTIMIZED: Dependency array minimized to prevent re-renders
  const handleSearch = useCallback(async (
      query: string, useLocation: boolean, isBatch: boolean, isSafeMode: boolean, isPaidMode: boolean,
      provider: ScraperProvider, serperKey: string, country: CountryCode, strategy: SerperStrategy, startIndex: number = 0
  ) => {
    stopRef.current = false;
    setEstimatedTimeLeft(null);
    setActiveSession(null);
    setExportFilters({ excludeClosed: false, excludeNoPhone: false, excludeDuplicates: false, onlyWithEmail: false });
    
    const costPerQuery = CONFIG.COSTS[strategy] || 3;

    if (!isBatch) {
      const cached = await cacheService.get(query);
      if (cached) {
          const newResult = { ...cached, status: cached.status + " (Cache)" };
          setState(prev => {
            if (stopRef.current) return prev; 
            const updated = mergeNewResults(prev.results, [newResult]);
            return { ...prev, isLoading: false, results: updated, error: null };
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
            await refreshHistoryCount();
            
            if (activeProjectId && !blCheck.isBlacklisted) {
                await projectService.addResultsToProject(activeProjectId, [item]);
                await loadProjects();
                await performAutoSave();
            }
            
            setState(prev => ({ ...prev, isLoading: false, results: mergeNewResults(prev.results, [item]), rawText: rawText }));
        } else {
             setState(prev => ({ ...prev, isLoading: false, results: prev.results, rawText: "Aucun résultat" }));
        }

      } catch (err: any) {
        if (stopRef.current) return;
        const errorMessage = err.message || "Erreur lors de la récupération.";
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
        addToast({type: 'error', title: "Erreur de Recherche", message: errorMessage});
      }

    } else {
      const lines = query.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;

      const initialSteps: TimelineStep[] = [
        { title: "Préparation", description: `${lines.length} lignes à traiter.`, status: 'completed' },
        { title: "Recherche & Analyse", description: "Lancement des requêtes...", status: 'active' },
        { title: "Finalisation", description: "En attente...", status: 'pending' },
      ];
      setTimelineSteps(initialSteps);
      setState(prev => ({ ...prev, isLoading: true, isBatchMode: true, progress: { current: startIndex, total: lines.length }, error: null, rawText: null }));

      for (let i = startIndex; i < lines.length; i += CONFIG.BATCH_CONCURRENCY) {
        if (stopRef.current) break;
        
        const chunk = lines.slice(i, i + CONFIG.BATCH_CONCURRENCY);
        setEstimatedTimeLeft(formatTimeLeft(lines.length - i));
        
        const promises = chunk.map(async (line) => {
            const cached = await cacheService.get(line);
            if (cached) return { success: true, data: { ...cached, searchedTerm: line }, fromCache: true };
            try {
                const { businesses } = await processSingleQuery(line, provider, serperKey, country, strategy);
                return { success: true, data: businesses[0], fromCache: false };
            } catch (e: any) {
                return { success: false, data: { name: line, status: "Erreur", address: e.message || "Erreur technique", phone: "", hours: "", searchedTerm: line } as BusinessData };
            }
        });

        try {
            const batchResults = await Promise.all(promises);
            if (stopRef.current) break;
            
            const realApiCallCount = batchResults.filter(r => !r.fromCache && r.success).length;
            if (realApiCallCount > 0) updateQuotaUsed(realApiCallCount * costPerQuery);

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
                        if (!res.fromCache) await cacheService.set(item.searchedTerm || item.name, item);
                    }
                } else if (!res.success && res.data) {
                    resultsToDisplay.push(res.data);
                }
            }

            if (validResultsToAdd.length > 0) {
                await refreshHistoryCount();
                if (activeProjectId) await projectService.addResultsToProject(activeProjectId, validResultsToAdd);
            }
            
            setState(prev => {
                if (stopRef.current) return prev;
                const newResults = mergeNewResults(prev.results, resultsToDisplay);
                const nextIndex = Math.min(i + CONFIG.BATCH_CONCURRENCY, lines.length);
                saveSession(query, nextIndex, newResults, { isPaidMode, serperKey, country, strategy });
                return { ...prev, progress: { current: nextIndex, total: lines.length }, results: newResults };
            });
                
            if (activeProjectId) await loadProjects();
            if (i + CONFIG.BATCH_CONCURRENCY < lines.length) await delay(CONFIG.BATCH_DELAY_MS);
        } catch (err: any) {
            if (stopRef.current) break;
            const errorSteps: TimelineStep[] = [
                initialSteps[0],
                { title: "Recherche & Analyse", description: err.message || "Erreur inconnue", status: 'failed' },
                { title: "Finalisation", description: "Processus échoué.", status: 'pending' },
            ];
            setTimelineSteps(errorSteps);
            const errorMessage = err.message || "Erreur lors de la récupération.";
            setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
            addToast({ type: 'error', title: "Erreur de Recherche par lot", message: errorMessage });
            break; // Stop batch on error
        }
      }

      if (!stopRef.current && !state.error) {
          const finalSteps: TimelineStep[] = [
              { title: "Préparation", description: `${lines.length} lignes traitées.`, status: 'completed' },
              { title: "Recherche & Analyse", description: "Analyse terminée.", status: 'completed' },
              { title: "Finalisation", description: "Sauvegarde des données.", status: 'completed' },
          ];
          setTimelineSteps(finalSteps);
      }
      
      if (activeProjectId) await performAutoSave();
      if (!stopRef.current) localStorage.removeItem(CONFIG.SESSION_KEY);
      if (activeProjectId) await loadProjects();
      
      setState(prev => ({ ...prev, isLoading: false }));
      setEstimatedTimeLeft(null);
    }
  }, [activeProjectId, loadProjects, performAutoSave, updateQuotaUsed, saveSession, refreshHistoryCount, addToast, state.error]); 

  const resumeSession = useCallback(() => {
    if (!activeSession) return;
    setState(prev => ({
        ...prev,
        results: activeSession.results,
        progress: { current: activeSession.currentIndex, total: activeSession.query.split('\n').filter(l => l.trim()).length }
    }));

    handleSearch(
        activeSession.query, false, true, true, activeSession.config.isPaidMode, 'serper_eco',
        activeSession.config.serperKey, activeSession.config.country, activeSession.config.strategy, activeSession.currentIndex
    );
    setActiveSession(null);
  }, [activeSession, handleSearch]);

  const handleStop = () => { 
      stopRef.current = true; 
      setState(prev => ({ ...prev, isLoading: false }));
      setTimelineSteps(prev => [
          prev[0],
          { title: "Recherche & Analyse", description: "Arrêt manuel par l'utilisateur.", status: 'failed' },
          { title: "Finalisation", description: "Processus interrompu.", status: 'pending' },
      ]);
      addToast({type: 'info', title: 'Arrêt Manuel', message: 'Le traitement du lot a été interrompu.'})
  };

  const handleClearResults = () => { stopRef.current = true; setState({ isLoading: false, isBatchMode: false, progress: { current: 0, total: 0 }, results: [], error: null, rawText: null }); setActiveProjectId(null); setDirHandle(null); };

  // OPTIMIZED: Memoized filtered data to avoid recalculation on every render
  const filteredData = useMemo(() => {
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
  }, [state.results, exportFilters]);

  const downloadExcel = useCallback(() => {
    if (filteredData.length === 0) { addToast({type: 'info', title: 'Exportation Vide', message: 'Aucune donnée à exporter selon les filtres actuels.'}); return; }
    const fileName = `lead_harvest_${activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : 'temp'}_${new Date().toISOString().slice(0, 10)}`;
    exportToExcel(filteredData, fileName, columnLabels);
    addToast({type: 'success', title: 'Exportation Réussie', message: `${filteredData.length} lignes exportées en Excel.`});
  }, [filteredData, activeProjectId, projects, columnLabels, addToast]);
  
  const downloadJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(filteredData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lead_harvest_${activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : 'temp'}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    addToast({type: 'success', title: 'Exportation Réussie', message: `${filteredData.length} lignes exportées en JSON.`});
  }, [filteredData, activeProjectId, projects, addToast]);

  const downloadHTML = useCallback(() => {
      const projName = activeProjectId ? projects.find(p => p.id === activeProjectId)?.name || 'Projet' : 'Session Temporaire';
      generateInteractiveHTML(filteredData, projName);
  }, [filteredData, activeProjectId, projects, generateInteractiveHTML]);

  const stats = useMemo(() => {
      const actives = state.results.filter(r => {
          const s = r.status?.toLowerCase() || "";
          return s.includes('activ') || s.includes('ouvert') || s.includes('web') || s.includes('trouvé') || s.includes('(cache)');
      }).length;

      const closed = state.results.filter(r => {
          const s = r.status?.toLowerCase() || "";
          return s.includes('définitiv') || s.includes('permanent');
      }).length;
      
      const warnings = state.results.filter(r => {
          const s = r.status?.toLowerCase() || "";
          return s.includes('ferm') || s.includes('doublon') || s.includes('ignoré') || s.includes('erreur');
      }).length;

      const emails = state.results.filter(r => r.email && r.email.trim() !== '').length;

      return {
          actives,
          closed,
          warnings,
          emails
      };
  }, [state.results]);

  if (authLoading) {
      return (
        <Suspense fallback={<div className="fixed inset-0 bg-slate-900" />}>
            <LoadingScreen />
        </Suspense>
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
            <div className="mb-8 p-4 rounded-xl bg-white border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up shadow-lg shadow-indigo-100/50">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><PlayCircle className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Session précédente détectée</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Reprendre là où vous vous êtes arrêté ?</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button onClick={discardSession} className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Ignorer</button>
                    <button onClick={resumeSession} className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg btn-modern flex items-center justify-center gap-2"><Zap className="w-3.5 h-3.5" /> Reprendre</button>
                </div>
            </div>
        )}

        <div className="text-center mb-12 animate-scale-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Sparkles className="w-3 h-3 animate-float" />
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
            onCreateProject={(name) => {
                handleCreateProject(name);
                addToast({type: 'success', title: 'Dossier Créé', message: `Le dossier "${name}" est maintenant actif.`});
            }}
            quotaLimit={quotaLimit}
            quotaUsed={quotaUsed}
            onUpdateQuotaLimit={handleUpdateQuotaLimit}
            onResetQuota={handleResetQuota}
        />

        <Suspense fallback={<div className="h-40" />}>
            {state.isBatchMode && (state.isLoading || state.progress.current > 0) && (
              <BatchProgress
                  progress={state.progress.current}
                  total={state.progress.total}
                  estimatedTimeLeft={estimatedTimeLeft}
                  timelineSteps={timelineSteps}
                  onStop={handleStop}
                  isLoading={state.isLoading}
              />
            )}
        </Suspense>

        {state.error && !state.isLoading && (
          <div className="max-w-4xl mx-auto mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center gap-3 animate-fade-in">
            <AlertOctagon className="w-5 h-5" /> <span>{state.error}</span>
          </div>
        )}

        {(state.results.length > 0 || activeProjectId) && (
          <div className="space-y-6">
            
            <DashboardStats stats={stats} />

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-2 mb-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 bg-slate-900 text-white rounded-full text-xs font-bold shadow-md">{filteredData.length}</span>
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
                <button onClick={handleClearResults} title="Fermer la vue" aria-label="Fermer la vue des résultats" className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"><X className="w-4 h-4" /></button>
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
                    <button onClick={downloadHTML} className="group flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-white rounded-lg border border-slate-200 shadow-sm hover-lift" title="Télécharger Mini-App HTML autonome"><FileCode className="w-3.5 h-3.5" /></button>
                    <button onClick={downloadJSON} className="group flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-white rounded-lg border border-slate-200 shadow-sm hover-lift" title="Télécharger JSON"><FileJson className="w-3.5 h-3.5" /></button>
                    <button onClick={downloadExcel} className="group flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg btn-modern whitespace-nowrap"><FileSpreadsheet className="w-3.5 h-3.5 group-hover:animate-bounce" /> Excel</button>
                </div>
              </div>
            </div>

            <ResultTable 
                data={filteredData} 
                onUpdate={handleUpdateResult} 
                columnLabels={columnLabels}
            />

            <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 flex items-start gap-3 max-w-2xl mx-auto shadow-sm animate-fade-in">
               <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
               <div className="space-y-1">
                 <p>Les données sont enregistrées automatiquement en local. Aucune donnée ne transite vers nos serveurs.</p>
               </div>
            </div>
          </div>
        )}
        
        <Suspense fallback={<div className="fixed inset-0 bg-black/10 z-[101]" />}>
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
        </Suspense>
        
      </main>
    </div>
  );
};

const App: React.FC = () => (
    <ToastProvider>
        <AppContent />
    </ToastProvider>
);


export default App;