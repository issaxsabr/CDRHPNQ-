
import { get, set, del, keys, entries } from 'idb-keyval';
import { BusinessData, Project } from '../types';

const CACHE_PREFIX = 'mapscraper_cache_';
const PROJECTS_INDEX_KEY = 'mapscraper_projects_index';
const PROJECT_CONTENT_PREFIX = 'mapscraper_project_content_';
const GLOBAL_FINGERPRINT_KEY = 'mapscraper_global_fingerprints'; // { "nom|adresse": "projectId" }
const LOCAL_DIR_HANDLE_PREFIX = 'mapscraper_local_handle_'; // Changé pour inclure l'ID du projet
const TTL_24H = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

interface CacheEntry {
  data: BusinessData;
  timestamp: number;
}

// --- FILE SYSTEM PERSISTENCE SERVICE ---
export const fileSystemService = {
    saveHandle: async (projectId: string, handle: any) => {
        await set(`${LOCAL_DIR_HANDLE_PREFIX}${projectId}`, handle);
    },
    getHandle: async (projectId: string) => {
        return await get<any>(`${LOCAL_DIR_HANDLE_PREFIX}${projectId}`);
    },
    clearHandle: async (projectId: string) => {
        await del(`${LOCAL_DIR_HANDLE_PREFIX}${projectId}`);
    }
};

// --- BLACKLIST SERVICE ---

// MODIFICATION : On autorise .gouv, .org, .edu etc. On ne bloque que les annuaires génériques.
const BLACKLIST_DOMAINS = [
    'pagesjaunes.fr', 'yellowpages.ca', 'yelp.', 'tripadvisor.', 
    'societe.com', 'linkedin.com', 'facebook.com', 'instagram.com',
    'mairie.net' // Souvent un annuaire non officiel, à voir si vous voulez le garder
];

// MODIFICATION : Suppression des mots clés gouvernementaux (Mairie, Police, etc.)
const BLACKLIST_KEYWORDS = [
    // Liste vide pour autoriser Mairies, Hôpitaux, Associations, etc.
];

export const blacklistService = {
    isBlacklisted: (item: BusinessData): { isBlacklisted: boolean; reason?: string } => {
        const nameLower = item.name.toLowerCase();
        
        // 1. Keyword Check
        for (const kw of BLACKLIST_KEYWORDS) {
            if (nameLower.startsWith(kw) || nameLower.includes(` ${kw} `)) {
                return { isBlacklisted: true, reason: `Mot-clé interdit: "${kw}"` };
            }
        }

        // 2. Domain Check
        if (item.website) {
            try {
                const hostname = new URL(item.website).hostname.toLowerCase();
                for (const domain of BLACKLIST_DOMAINS) {
                    if (hostname.endsWith(domain) || hostname.includes(domain)) {
                        return { isBlacklisted: true, reason: `Domaine ignoré (Annuaire/Social): "${domain}"` };
                    }
                }
            } catch (e) {
                // Invalid URL, ignore check
            }
        }

        return { isBlacklisted: false };
    }
};

// --- GLOBAL DEDUPLICATION SERVICE ---

export const globalIndexService = {
    /**
     * Génère une empreinte unique pour un lead (Nom + Adresse simplifiée ou Website)
     */
    generateFingerprint: (item: BusinessData): string => {
        if (item.website && !item.website.includes('google') && !item.website.includes('facebook')) {
            return `WEB:${item.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
        }
        // Fallback: Nom + 10 premiers chars de l'adresse
        const simpleAddress = (item.address || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
        const simpleName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `GEO:${simpleName}|${simpleAddress}`;
    },

    /**
     * Vérifie si le lead existe dans UN AUTRE projet
     */
    checkDuplicate: async (item: BusinessData): Promise<{ isDuplicate: boolean; projectId?: string }> => {
        const fingerprint = globalIndexService.generateFingerprint(item);
        const index = await get<Record<string, string>>(GLOBAL_FINGERPRINT_KEY) || {};
        
        if (index[fingerprint]) {
            return { isDuplicate: true, projectId: index[fingerprint] };
        }
        return { isDuplicate: false };
    },

    /**
     * Enregistre les empreintes pour un projet donné
     */
    registerItems: async (items: BusinessData[], projectId: string) => {
        const index = await get<Record<string, string>>(GLOBAL_FINGERPRINT_KEY) || {};
        let changed = false;
        
        items.forEach(item => {
            const fp = globalIndexService.generateFingerprint(item);
            if (!index[fp]) {
                index[fp] = projectId;
                changed = true;
            }
        });

        if (changed) {
            await set(GLOBAL_FINGERPRINT_KEY, index);
        }
    }
};

// --- PROJECT SERVICE ---

export const projectService = {
  getAllProjects: async (): Promise<Project[]> => {
    try {
      const index = await get<Project[]>(PROJECTS_INDEX_KEY);
      return (index || []).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      console.error("Error fetching projects", e);
      return [];
    }
  },

  createProject: async (name: string, autoExportFormats?: ('xlsx' | 'json' | 'html')[]): Promise<Project> => {
    const projects = await projectService.getAllProjects();
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      itemCount: 0,
      autoExportFormats
    };
    
    await set(PROJECTS_INDEX_KEY, [newProject, ...projects]);
    await set(PROJECT_CONTENT_PREFIX + newProject.id, []);
    
    return newProject;
  },

  deleteProject: async (id: string): Promise<void> => {
    const projects = await projectService.getAllProjects();
    const updatedProjects = projects.filter(p => p.id !== id);
    await set(PROJECTS_INDEX_KEY, updatedProjects);
    await del(PROJECT_CONTENT_PREFIX + id);
    
    // Cleanup Local Handle for this project
    await fileSystemService.clearHandle(id);
    
    // Cleanup Global Index (Optional but cleaner)
    // Note: Doing a full cleanup is expensive, we might skip it or do it lazily
  },

  addResultsToProject: async (projectId: string, newResults: BusinessData[]): Promise<void> => {
    try {
      const contentKey = PROJECT_CONTENT_PREFIX + projectId;
      const currentContent = await get<BusinessData[]>(contentKey) || [];
      
      const mergedContent = [...currentContent];
      let addedCount = 0;
      const itemsToRegister: BusinessData[] = [];

      newResults.forEach(newItem => {
        // Local Dedupe (in same project)
        const exists = mergedContent.some(existing => 
          existing.name === newItem.name && existing.address === newItem.address
        );
        if (!exists) {
          mergedContent.push(newItem);
          itemsToRegister.push(newItem);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await set(contentKey, mergedContent);
        
        // Update Index Global for Cross-Project Dedupe
        await globalIndexService.registerItems(itemsToRegister, projectId);

        // Update Project Meta
        const projects = await projectService.getAllProjects();
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex >= 0) {
          projects[projectIndex].updatedAt = Date.now();
          projects[projectIndex].itemCount = mergedContent.length;
          await set(PROJECTS_INDEX_KEY, projects);
        }
      }
    } catch (e) {
      console.error("Error adding results to project", e);
    }
  },

  updateProjectContent: async (projectId: string, fullData: BusinessData[]): Promise<void> => {
      try {
        const contentKey = PROJECT_CONTENT_PREFIX + projectId;
        await set(contentKey, fullData);

        const projects = await projectService.getAllProjects();
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex >= 0) {
          projects[projectIndex].updatedAt = Date.now();
          projects[projectIndex].itemCount = fullData.length;
          await set(PROJECTS_INDEX_KEY, projects);
        }
      } catch (e) {
        console.error("Error updating project content", e);
      }
  },

  getProjectContent: async (projectId: string): Promise<BusinessData[]> => {
    return await get<BusinessData[]>(PROJECT_CONTENT_PREFIX + projectId) || [];
  },
  
  getProjectName: async (projectId: string): Promise<string> => {
      const projects = await projectService.getAllProjects();
      const p = projects.find(proj => proj.id === projectId);
      return p ? p.name : 'Inconnu';
  }
};


// --- CACHE SERVICE ---

export const cacheService = {
  get: async (term: string): Promise<BusinessData | null> => {
    try {
      const key = CACHE_PREFIX + term.toLowerCase().trim();
      const entry = await get<CacheEntry>(key);

      if (!entry) return null;

      const now = Date.now();
      if (now - entry.timestamp > TTL_24H) {
        await del(key);
        return null;
      }
      return entry.data;
    } catch (e) {
      console.warn('Error reading from IDB cache', e);
      return null;
    }
  },

  set: async (term: string, data: BusinessData): Promise<void> => {
    try {
      const key = CACHE_PREFIX + term.toLowerCase().trim();
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
      };
      await set(key, entry);
    } catch (e) {
      console.warn('Error writing to IDB cache', e);
    }
  },

  count: async (): Promise<number> => {
    try {
      const allKeys = await keys();
      return allKeys.filter(k => typeof k === 'string' && k.startsWith(CACHE_PREFIX)).length;
    } catch (e) {
      return 0;
    }
  },

  getAll: async (): Promise<{term: string, data: BusinessData, timestamp: number}[]> => {
    try {
      const allEntries = await entries();
      return allEntries
        .filter(([k]) => typeof k === 'string' && k.startsWith(CACHE_PREFIX))
        .map(([k, v]) => {
          const val = v as CacheEntry;
          return {
            term: (k as string).replace(CACHE_PREFIX, ''),
            data: val.data,
            timestamp: val.timestamp
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error('Failed to get all cache', e);
      return [];
    }
  },

  clear: async (): Promise<void> => {
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(CACHE_PREFIX));
      for (const key of cacheKeys) {
        await del(key);
      }
    } catch (e) {
      console.error('Failed to clear cache', e);
    }
  }
};
