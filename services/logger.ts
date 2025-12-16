/**
 * Logger configurable pour l'application
 * - Désactivé automatiquement en production (sauf erreurs)
 * - Supporte différents niveaux de log
 * - Peut être étendu pour envoyer vers un service externe
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  prefix: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Détection de l'environnement
const isDev = import.meta.env?.DEV ?? false;
const isDevMode = import.meta.env?.VITE_DEV_MODE === 'true';

const defaultConfig: LoggerConfig = {
  enabled: isDev || isDevMode,
  minLevel: isDev ? 'debug' : 'warn',
  prefix: '[Scavenger]',
};

let config: LoggerConfig = { ...defaultConfig };

const shouldLog = (level: LogLevel): boolean => {
  if (!config.enabled && level !== 'error') return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
};

const formatMessage = (level: LogLevel, message: string): string => {
  const timestamp = new Date().toISOString().slice(11, 23);
  return `${config.prefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;
};

/**
 * Logger principal de l'application
 */
export const logger = {
  /**
   * Configure le logger
   */
  configure(newConfig: Partial<LoggerConfig>): void {
    config = { ...config, ...newConfig };
  },

  /**
   * Log de debug (uniquement en développement)
   */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message), ...args);
    }
  },

  /**
   * Log d'information
   */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message), ...args);
    }
  },

  /**
   * Log d'avertissement
   */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },

  /**
   * Log d'erreur (toujours actif)
   */
  error(message: string, error?: unknown, ...args: unknown[]): void {
    console.error(formatMessage('error', message), error, ...args);

    // Ici on pourrait envoyer vers un service de monitoring
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  },

  /**
   * Groupe de logs (pour les opérations complexes)
   */
  group(label: string): void {
    if (shouldLog('debug')) {
      console.group(formatMessage('debug', label));
    }
  },

  groupEnd(): void {
    if (shouldLog('debug')) {
      console.groupEnd();
    }
  },

  /**
   * Log de performance
   */
  time(label: string): void {
    if (shouldLog('debug')) {
      console.time(`${config.prefix} ${label}`);
    }
  },

  timeEnd(label: string): void {
    if (shouldLog('debug')) {
      console.timeEnd(`${config.prefix} ${label}`);
    }
  },
};

export default logger;
