
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project } from '../types';

const DB_NAME = 'mapscraper-db';
const DB_VERSION = 1;

// Définition du schéma de la base de données
interface MapScraperDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  businesses: {
    key: string;
    value: {
      id: string; // UUID
      projectId: string;
      fingerprint: string;
      // Champs indexés non chiffrés
      name: string;
      email?: string;
      status: string;
      category?: string;
      // Blob de données chiffrées
      secureData: string;
    };
    indexes: {
      'by-project': string;
      'by-fingerprint': string;
    };
  };
  cache: {
    key: string;
    value: any; // Données de cache chiffrées
  };
  keyval: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<MapScraperDB>> | null = null;

export const getDB = (): Promise<IDBPDatabase<MapScraperDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<MapScraperDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('businesses')) {
          const store = db.createObjectStore('businesses', { keyPath: 'id' });
          store.createIndex('by-project', 'projectId');
          store.createIndex('by-fingerprint', 'fingerprint', { unique: true });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
      },
    });
  }
  return dbPromise;
};
