// FIX: Add default import for 'React' to use types like React.MouseEvent
import React, { useState, useEffect } from 'react';
import { Project, BusinessData } from '../types';
import { projectService } from '../services/storage';

export const useProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    const loadProjects = async () => {
        try {
            const all = await projectService.getAllProjects();
            setProjects(all);
        } catch (e) {
            console.error("Failed to load projects", e);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const handleCreateProject = async (name: string, autoExportFormats?: ('xlsx' | 'json' | 'html')[]) => {
        const newProj = await projectService.createProject(name, autoExportFormats);
        await loadProjects();
        setActiveProjectId(newProj.id);
        return newProj;
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(window.confirm("Supprimer ce dossier et toutes ses données ?")) {
            await projectService.deleteProject(id);
            if(activeProjectId === id) {
                setActiveProjectId(null);
            }
            await loadProjects();
            return true; // Indiquer la suppression
        }
        return false;
    };

    const handleSelectProject = async (id: string | null): Promise<BusinessData[] | null> => {
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
    };

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