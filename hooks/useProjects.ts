

import React, { useState, useEffect, useCallback } from 'react';
import { Project, BusinessData } from '../types';
import { projectService } from '../services/storage';

export const useProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    const loadProjects = useCallback(async () => {
        try {
            const all = await projectService.getAllProjects();
            setProjects(all);
        } catch (e) {
            console.error("Failed to load projects", e);
        }
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const handleCreateProject = useCallback(async (name: string, autoExportFormats?: ('xlsx' | 'json' | 'html')[]) => {
        const newProj = await projectService.createProject(name, autoExportFormats);
        await loadProjects();
        setActiveProjectId(newProj.id);
        return newProj;
    }, [loadProjects]);

    const handleDeleteProject = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(window.confirm("Supprimer ce dossier et toutes ses données ?")) {
            await projectService.deleteProject(id);
            if(activeProjectId === id) {
                setActiveProjectId(null);
            }
            await loadProjects();
            return true;
        }
        return false;
    }, [activeProjectId, loadProjects]);

    const handleSelectProject = useCallback(async (id: string | null): Promise<BusinessData[] | null> => {
        setActiveProjectId(id);
        if (id) {
            try {
                return await projectService.getProjectContent(id);
            } catch (e) {
                console.error(`Failed to get content for project ${id}`, e);
                return [];
            }
        }
        return null;
    }, []);

    return {
        projects,
        activeProjectId,
        setActiveProjectId,
        loadProjects,
        handleCreateProject,
        handleDeleteProject,
        handleSelectProject,
    };
};