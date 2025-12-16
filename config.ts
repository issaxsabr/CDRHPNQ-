/**
 * Configuration centralisée de l'application
 * Toutes les constantes et paramètres configurables sont ici
 */

import { SerperStrategy } from './types';

/**
 * Configuration des sessions et du stockage
 */
export const STORAGE_CONFIG = {
  /** Clé pour la session active dans localStorage */
  SESSION_KEY: 'mapscraper_active_session_v1',

  /** Préfixe pour les handles de dossiers locaux */
  LOCAL_DIR_HANDLE_PREFIX: 'mapscraper_local_handle_',

  /** Clé pour les labels de colonnes personnalisées */
  COLUMN_LABELS_KEY: 'mapscraper_column_labels',

  /** Clé pour marquer l'onboarding comme complété */
  ONBOARDING_KEY: 'scavenger_onboarding_complete_v1',

  /** Clé pour le quota utilisateur */
  QUOTA_KEY: 'mapscraper_quota',
} as const;

/**
 * Configuration du traitement par lots (batch)
 */
export const BATCH_CONFIG = {
  /** Nombre de requêtes en parallèle */
  CONCURRENCY: 3,

  /** Délai entre chaque lot pour éviter le rate-limit (ms) */
  DELAY_MS: 1000,

  /** Temps moyen estimé par requête pour le calcul du temps restant (ms) */
  AVG_REQUEST_TIME_MS: 2000,
} as const;

/**
 * Configuration de l'auto-sauvegarde
 */
export const AUTO_SAVE_CONFIG = {
  /** Intervalle de sauvegarde automatique (ms) - 5 minutes */
  INTERVAL_MS: 5 * 60 * 1000,
} as const;

/**
 * Configuration des quotas par défaut
 */
export const QUOTA_CONFIG = {
  /** Limite de quota par défaut */
  DEFAULT_LIMIT: 5000,

  /** Seuils d'alerte pour la barre de quota (en %) */
  WARNING_THRESHOLD: 70,
  CRITICAL_THRESHOLD: 90,
} as const;

/**
 * Coûts en crédits Serper par stratégie
 */
export const SERPER_COSTS: Record<SerperStrategy, number> = {
  web_basic: 1,
  maps_basic: 3,
  maps_web_enrich: 4,
} as const;

/**
 * Configuration de l'UI
 */
export const UI_CONFIG = {
  /** Délai avant l'affichage du tour d'onboarding (ms) */
  ONBOARDING_DELAY_MS: 1500,

  /** Hauteur d'une ligne dans le tableau virtuel (px) */
  TABLE_ROW_HEIGHT: 80,

  /** Durée par défaut des toasts (ms) */
  TOAST_DURATION_MS: 5000,

  /** Délai de debounce pour les inputs (ms) */
  INPUT_DEBOUNCE_MS: 300,
} as const;

/**
 * Configuration de sécurité
 */
export const SECURITY_CONFIG = {
  /** Nombre d'itérations PBKDF2 pour la dérivation de clé */
  PBKDF2_ITERATIONS: 100000,

  /** Taille de l'IV pour AES-GCM (bytes) */
  AES_IV_LENGTH: 12,
} as const;

/**
 * Configuration de validation
 */
export const VALIDATION_CONFIG = {
  /** Longueur maximale des champs texte */
  MAX_NAME_LENGTH: 200,
  MAX_ADDRESS_LENGTH: 300,
  MAX_MEMO_LENGTH: 500,
  MAX_GENERIC_LENGTH: 100,

  /** Limites pour les tableaux */
  MAX_PHONES_COUNT: 10,
  MAX_EMAILS_COUNT: 20,
} as const;

/**
 * Configuration API Gemini
 */
export const GEMINI_CONFIG = {
  /** Température pour les réponses (0 = déterministe, 1 = créatif) */
  TEMPERATURE: 0.1,

  /** Longueur maximale du contexte envoyé à Gemini (caractères) */
  MAX_CONTEXT_LENGTH: 7000,
} as const;

/**
 * Domaines blacklistés pour le filtrage des résultats
 */
export const BLACKLIST_DOMAINS = [
  'pagesjaunes.fr',
  'yellowpages.ca',
  'yelp.',
  'tripadvisor.',
  'societe.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'mairie.net',
] as const;

/**
 * Configuration legacy (pour rétrocompatibilité)
 * @deprecated Utiliser les configurations spécifiques ci-dessus
 */
export const CONFIG = {
  SESSION_KEY: STORAGE_CONFIG.SESSION_KEY,
  BATCH_CONCURRENCY: BATCH_CONFIG.CONCURRENCY,
  BATCH_DELAY_MS: BATCH_CONFIG.DELAY_MS,
  AUTO_SAVE_INTERVAL_MS: AUTO_SAVE_CONFIG.INTERVAL_MS,
  COSTS: SERPER_COSTS,
} as const;

/**
 * Export par défaut de toute la configuration
 */
export default {
  STORAGE: STORAGE_CONFIG,
  BATCH: BATCH_CONFIG,
  AUTO_SAVE: AUTO_SAVE_CONFIG,
  QUOTA: QUOTA_CONFIG,
  SERPER_COSTS,
  UI: UI_CONFIG,
  SECURITY: SECURITY_CONFIG,
  VALIDATION: VALIDATION_CONFIG,
  GEMINI: GEMINI_CONFIG,
  BLACKLIST_DOMAINS,
} as const;
