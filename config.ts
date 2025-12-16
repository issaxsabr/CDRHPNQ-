
export const CONFIG = {
  SESSION_KEY: 'mapscraper_active_session_v1',
  BATCH_CONCURRENCY: 3, // Nombre de requêtes en parallèle (Mode Turbo)
  BATCH_DELAY_MS: 1000, // Délai entre chaque lot pour éviter le rate-limit
  AUTO_SAVE_INTERVAL_MS: 5 * 60 * 1000, // 5 Minutes
  
  // COÛTS SERPER
  COSTS: {
    web_basic: 1,
    maps_basic: 3,
    maps_web_enrich: 4
  }
} as const;
