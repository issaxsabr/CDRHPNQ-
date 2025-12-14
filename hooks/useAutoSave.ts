

import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, BusinessData, ColumnLabelMap, FileSystemDirectoryHandle, ToastMessage } from '../types';
import { projectService, fileSystemService } from '../services/storage';
import { getInteractiveHTMLContent, createExcelWorkbook } from '../utils/exportUtils';
import { write } from 'xlsx';
import { CONFIG } from '../config';

type AddToastFn = (toast: Omit<ToastMessage, 'id'>) => void;

export const useAutoSave = (
    activeProjectId: string | null, 
    projects: Project[], 
    columnLabels: ColumnLabelMap,
    addToast: AddToastFn
) => {
    const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [hasStoredHandle, setHasStoredHandle] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

    // Refs for stable callbacks
    const projectsRef = useRef(projects);
    useEffect(() => { projectsRef.current = projects; }, [projects]);
    
    const columnLabelsRef = useRef(columnLabels);
    useEffect(() => { columnLabelsRef.current = columnLabels; }, [columnLabels]);

    useEffect(() => {
        const checkProjectHandle = async () => {
            setDirHandle(null);
            setHasStoredHandle(false);
            setLastAutoSave(null);

            if (activeProjectId) {
                try {
                    const handle = await fileSystemService.getHandle(activeProjectId);
                    if (handle) {
                        setHasStoredHandle(true);
                    }
                } catch(e) { console.error("Failed to check for stored directory handle", e); }
            }
        };
        checkProjectHandle();
    }, [activeProjectId]);

    const performAutoSave = useCallback(async (handleToUse?: FileSystemDirectoryHandle, silent = false) => {
        const handle = handleToUse || dirHandle;
        if (!handle || !activeProjectId) return false;

        try {
            const project = projectsRef.current.find(p => p.id === activeProjectId);
            if (!project) return false;
            
            const data = await projectService.getProjectContent(activeProjectId);
            if (data.length === 0) return true; 

            const baseName = `AUTOSAVE_${project.name.replace(/\s+/g, '_')}`;
            if(!silent) console.log("Exécution sauvegarde auto...");

            const jsonHandle = await handle.getFileHandle(`${baseName}_DATA.json`, { create: true });
            const writableJson = await jsonHandle.createWritable();
            await writableJson.write(JSON.stringify(data, null, 2));
            await writableJson.close();

            const wb = createExcelWorkbook(data, columnLabelsRef.current);
            const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
            
            const xlsxHandle = await handle.getFileHandle(`${baseName}.xlsx`, { create: true });
            const writableXlsx = await xlsxHandle.createWritable();
            await writableXlsx.write(excelBuffer);
            await writableXlsx.close();

            const htmlContent = getInteractiveHTMLContent(data, project.name, columnLabelsRef.current);
            const htmlHandle = await handle.getFileHandle(`${baseName}_APP.html`, { create: true });
            const writableHtml = await htmlHandle.createWritable();
            await writableHtml.write(htmlContent);
            await writableHtml.close();

            setLastAutoSave(Date.now());
            if(!silent) {
                addToast({type: 'success', title: 'Sauvegarde Auto Réussie', message: `Dossier "${project.name}" sauvegardé localement.`});
            }
            return true;
        } catch (err: any) {
            console.error("Erreur lors de la sauvegarde auto:", err);
            addToast({type: 'error', title: 'Échec Sauvegarde Auto', message: err.message || 'Vérifiez les permissions du dossier.'});
            if (dirHandle) setDirHandle(null);
            return false;
        }
    }, [dirHandle, activeProjectId, addToast]);

    useEffect(() => {
        if (!dirHandle || !activeProjectId) return;
        const intervalId = setInterval(() => performAutoSave(undefined, true), CONFIG.AUTO_SAVE_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [dirHandle, activeProjectId, performAutoSave]);

    const restoreFolderConnection = useCallback(async () => {
        if (!activeProjectId) return;
        try {
            const handle = await fileSystemService.getHandle(activeProjectId);
            if (!handle) {
                addToast({type: 'info', title: 'Aucun Dossier Mémorisé', message: 'Veuillez reconnecter manuellement le dossier.'});
                setHasStoredHandle(false);
                return;
            }
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                setDirHandle(handle);
                await performAutoSave(handle);
            } else {
                addToast({type: 'error', title: 'Permission Refusée', message: 'La sauvegarde automatique est désactivée.'});
            }
        } catch (e: any) {
            console.error("Erreur restauration dossier:", e);
            addToast({type: 'error', title: 'Erreur de Restauration', message: e.message || 'Impossible de se reconnecter au dossier.'});
        }
    }, [activeProjectId, performAutoSave, addToast]);
    
    const handleConnectLocalFolder = useCallback(async () => {
        if (!activeProjectId) {
            addToast({type: 'info', title: 'Aucun Dossier Actif', message: 'Veuillez sélectionner un dossier avant de le lier.'});
            return;
        }
        try {
            const handle = await window.showDirectoryPicker();
            if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
                addToast({type: 'error', title: 'Permission Refusée', message: 'La sauvegarde automatique ne fonctionnera pas.'});
                return;
            }
            setDirHandle(handle);
            await fileSystemService.saveHandle(activeProjectId, handle);
            setHasStoredHandle(true);
            await performAutoSave(handle);
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error("Erreur connexion dossier:", err);
            if (err.message && err.message.includes('Cross origin sub frames')) {
                 addToast({type: 'error', title: 'Fonctionnalité Bloquée', message: "Ouvrez l'application en plein écran pour utiliser cette fonction."});
            } else {
                 addToast({type: 'error', title: 'Erreur de Connexion', message: err.message || 'Impossible de lier le dossier.'});
            }
        }
    }, [activeProjectId, performAutoSave, addToast]);

    return {
        dirHandle,
        setDirHandle,
        hasStoredHandle,
        lastAutoSave,
        performAutoSave,
        restoreFolderConnection,
        handleConnectLocalFolder,
    };
};