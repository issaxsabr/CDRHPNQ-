
import { useState, useEffect } from 'react';
import { Project, BusinessData, ColumnLabelMap, FileSystemDirectoryHandle } from '../types';
import { projectService, fileSystemService } from '../services/storage';
import { getInteractiveHTMLContent, createExcelWorkbook } from '../utils/exportUtils';
import { write } from 'xlsx';

const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 Minutes

export const useAutoSave = (activeProjectId: string | null, projects: Project[], columnLabels: ColumnLabelMap) => {
    const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [hasStoredHandle, setHasStoredHandle] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

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

    const performAutoSave = async (handleToUse?: FileSystemDirectoryHandle) => {
        const handle = handleToUse || dirHandle;
        if (!handle || !activeProjectId) return false;

        try {
            const project = projects.find(p => p.id === activeProjectId);
            if (!project) return false;
            
            const data = await projectService.getProjectContent(activeProjectId);
            if (data.length === 0) return true; // No data to save, but not an error

            const baseName = `AUTOSAVE_${project.name.replace(/\s+/g, '_')}`;

            console.log("Exécution sauvegarde auto...");

            const jsonHandle = await handle.getFileHandle(`${baseName}_DATA.json`, { create: true });
            const writableJson = await jsonHandle.createWritable();
            await writableJson.write(JSON.stringify(data, null, 2));
            await writableJson.close();

            const wb = createExcelWorkbook(data, columnLabels);
            const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
            
            const xlsxHandle = await handle.getFileHandle(`${baseName}.xlsx`, { create: true });
            const writableXlsx = await xlsxHandle.createWritable();
            await writableXlsx.write(excelBuffer);
            await writableXlsx.close();

            const htmlContent = getInteractiveHTMLContent(data, project.name, columnLabels);
            const htmlHandle = await handle.getFileHandle(`${baseName}_APP.html`, { create: true });
            const writableHtml = await htmlHandle.createWritable();
            await writableHtml.write(htmlContent);
            await writableHtml.close();

            setLastAutoSave(Date.now());
            console.log("Sauvegarde auto OK");
            return true;
        } catch (err) {
            console.error("Erreur lors de la sauvegarde auto:", err);
            if (dirHandle) setDirHandle(null);
            return false;
        }
    };

    useEffect(() => {
        if (!dirHandle || !activeProjectId) return;
        const intervalId = setInterval(() => performAutoSave(), AUTO_SAVE_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [dirHandle, activeProjectId, projects, columnLabels]);

    const restoreFolderConnection = async () => {
        if (!activeProjectId) return;
        try {
            const handle = await fileSystemService.getHandle(activeProjectId);
            if (!handle) {
                alert("Aucun dossier mémorisé pour ce projet.");
                setHasStoredHandle(false);
                return;
            }
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                setDirHandle(handle);
                await performAutoSave(handle);
            } else {
                alert("Permission refusée. Veuillez reconnecter manuellement.");
            }
        } catch (e) {
            console.error("Erreur restauration dossier:", e);
            alert("Impossible de restaurer le dossier. Veuillez reconnecter.");
        }
    };
    
    const handleConnectLocalFolder = async () => {
        if (!activeProjectId) {
            alert("Veuillez sélectionner un dossier (projet) d'abord.");
            return;
        }
        try {
            const handle = await window.showDirectoryPicker();
            if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
                alert("Permission refusée. La sauvegarde auto ne fonctionnera pas.");
                return;
            }
            setDirHandle(handle);
            await fileSystemService.saveHandle(activeProjectId, handle);
            setHasStoredHandle(true);
            await performAutoSave(handle);
        } catch (err: any) {
            console.error("Annulé ou erreur:", err);
            if (err.name === 'AbortError') return;
            if (err.message && err.message.includes('Cross origin sub frames')) {
                alert("⚠️ Fonctionnalité bloquée par l'aperçu\n\nSolution : Ouvrez l'application en plein écran (Nouvel onglet) ou installez-la.");
            }
        }
    };

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
