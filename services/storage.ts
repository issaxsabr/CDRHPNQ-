
import { get, set, del, keys, entries } from 'idb-keyval';
import { BusinessData, Project } from '../types';
import { securePack, secureUnpack } from './security';

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
const BLACKLIST_DOMAINS = [
    'pagesjaunes.fr', 'yellowpages.ca', 'yelp.', 'tripadvisor.', 
    'societe.com', 'linkedin.com', 'facebook.com', 'instagram.com',
    'mairie.net'
];

const BLACKLIST_KEYWORDS: string[] = [];

export const blacklistService = {
    isBlacklisted: (item: BusinessData): { isBlacklisted: boolean; reason?: string } => {
        const nameLower = item.name.toLowerCase();
        
        for (const kw of BLACKLIST_KEYWORDS) {
            if (nameLower.startsWith(kw) || nameLower.includes(` ${kw} `)) {
                return { isBlacklisted: true, reason: `Mot-clé interdit: "${kw}"` };
            }
        }

        if (item.website) {
            try {
                const hostname = new URL(item.website).hostname.toLowerCase();
                for (const domain of BLACKLIST_DOMAINS) {
                    if (hostname.endsWith(domain) || hostname.includes(domain)) {
                        return { isBlacklisted: true, reason: `Domaine ignoré (Annuaire/Social): "${domain}"` };
                    }
                }
            } catch (e) { /* Invalid URL, ignore check */ }
        }

        return { isBlacklisted: false };
    }
};

// --- GLOBAL DEDUPLICATION SERVICE ---
export const globalIndexService = {
    generateFingerprint: (item: BusinessData): string => {
        if (item.website && !item.website.includes('google') && !item.website.includes('facebook')) {
            return `WEB:${item.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
        }
        const simpleAddress = (item.address || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
        const simpleName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `GEO:${simpleName}|${simpleAddress}`;
    },

    checkDuplicate: async (item: BusinessData): Promise<{ isDuplicate: boolean; projectId?: string }> => {
        const fingerprint = globalIndexService.generateFingerprint(item);
        const index = await get<Record<string, string>>(GLOBAL_FINGERPRINT_KEY) || {};
        
        if (index[fingerprint]) {
            return { isDuplicate: true, projectId: index[fingerprint] };
        }
        return { isDuplicate: false };
    },

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
    await set(PROJECT_CONTENT_PREFIX + newProject.id, await securePack([]));
    
    return newProject;
  },

  deleteProject: async (id: string): Promise<void> => {
    const projects = await projectService.getAllProjects();
    const updatedProjects = projects.filter(p => p.id !== id);
    await set(PROJECTS_INDEX_KEY, updatedProjects);
    await del(PROJECT_CONTENT_PREFIX + id);
    await fileSystemService.clearHandle(id);
  },

  addResultsToProject: async (projectId: string, newResults: BusinessData[]): Promise<void> => {
    try {
      const contentKey = PROJECT_CONTENT_PREFIX + projectId;
      const encryptedContent = await get<string>(contentKey);
      const currentContent = await secureUnpack(encryptedContent) || [];
      
      const mergedContent = [...currentContent];
      let addedCount = 0;
      const itemsToRegister: BusinessData[] = [];

      newResults.forEach(newItem => {
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
        await set(contentKey, await securePack(mergedContent));
        await globalIndexService.registerItems(itemsToRegister, projectId);

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
        await set(contentKey, await securePack(fullData));

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
    const encryptedContent = await get<string>(PROJECT_CONTENT_PREFIX + projectId);
    return await secureUnpack(encryptedContent) || [];
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
      const encryptedEntry = await get<string>(key);
      const entry: CacheEntry | null = await secureUnpack(encryptedEntry);

      if (!entry) return null;

      if (Date.now() - entry.timestamp > TTL_24H) {
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
      const entry: CacheEntry = { data, timestamp: Date.now() };
      await set(key, await securePack(entry));
    } catch (e) {
      console.warn('Error writing to IDB cache', e);
    }
  },

  count: async (): Promise<number> => {
    try {
      const allKeys = await keys();
      return allKeys.filter(k => typeof k === 'string' && k.startsWith(CACHE_PREFIX)).length;
    } catch (e) { return 0; }
  },

  getAll: async (): Promise<{term: string, data: BusinessData, timestamp: number}[]> => {
    try {
      const allEntries = await entries();
      const decryptedItems = await Promise.all(
          allEntries
              .filter(([k]) => typeof k === 'string' && k.startsWith(CACHE_PREFIX))
              .map(async ([k, v]) => {
                  const entry: CacheEntry | null = await secureUnpack(v as string);
                  if (!entry) return null;
                  return {
                      term: (k as string).replace(CACHE_PREFIX, ''),
                      data: entry.data,
                      timestamp: entry.timestamp
                  };
              })
      );
      return (decryptedItems.filter(Boolean) as {term: string, data: BusinessData, timestamp: number}[])
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