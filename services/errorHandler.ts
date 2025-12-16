/**
 * Gestion centralisée des erreurs
 * - Codes d'erreur standardisés
 * - Messages utilisateur en français
 * - Logging automatique
 */

import { logger } from './logger';

/**
 * Codes d'erreur de l'application
 */
export enum ErrorCode {
  // Erreurs réseau
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Erreurs API
  API_ERROR = 'API_ERROR',
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',

  // Erreurs de validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Erreurs de stockage
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',

  // Erreurs d'authentification
  AUTH_ERROR = 'AUTH_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Erreurs génériques
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
}

/**
 * Messages utilisateur pour chaque code d'erreur
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Problème de connexion. Vérifiez votre connexion internet.',
  [ErrorCode.TIMEOUT]: "L'opération a pris trop de temps. Veuillez réessayer.",

  [ErrorCode.API_ERROR]: 'Erreur lors de la communication avec le serveur.',
  [ErrorCode.API_KEY_INVALID]: 'Clé API invalide ou expirée. Veuillez vérifier la configuration.',
  [ErrorCode.API_RATE_LIMITED]: 'Trop de requêtes. Veuillez patienter quelques secondes.',
  [ErrorCode.API_QUOTA_EXCEEDED]: 'Quota API épuisé. Veuillez réessayer plus tard.',

  [ErrorCode.VALIDATION_ERROR]: 'Les données saisies sont invalides.',
  [ErrorCode.INVALID_INPUT]: 'Format de données incorrect.',

  [ErrorCode.STORAGE_ERROR]: 'Erreur lors de la sauvegarde des données.',
  [ErrorCode.ENCRYPTION_ERROR]: 'Erreur lors du chiffrement des données.',
  [ErrorCode.DECRYPTION_ERROR]: 'Erreur lors de la lecture des données. Données potentiellement corrompues.',

  [ErrorCode.AUTH_ERROR]: "Erreur d'authentification. Veuillez vous reconnecter.",
  [ErrorCode.SESSION_EXPIRED]: 'Votre session a expiré. Veuillez vous reconnecter.',

  [ErrorCode.UNKNOWN_ERROR]: 'Une erreur inattendue est survenue.',
  [ErrorCode.OPERATION_CANCELLED]: 'Opération annulée.',
};

/**
 * Erreur personnalisée de l'application
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly originalError?: unknown;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    options?: {
      message?: string;
      userMessage?: string;
      recoverable?: boolean;
      originalError?: unknown;
      context?: Record<string, unknown>;
    }
  ) {
    const userMessage = options?.userMessage || ERROR_MESSAGES[code];
    super(options?.message || userMessage);

    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.recoverable = options?.recoverable ?? true;
    this.originalError = options?.originalError;
    this.context = options?.context;

    // Capture la stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Analyse une erreur inconnue et retourne une AppError
 */
export function handleError(error: unknown, context?: Record<string, unknown>): AppError {
  // Si c'est déjà une AppError, on la retourne
  if (error instanceof AppError) {
    logger.error(`[${error.code}] ${error.message}`, error.originalError, error.context);
    return error;
  }

  // Erreur standard JavaScript
  if (error instanceof Error) {
    const appError = inferErrorCode(error, context);
    logger.error(`[${appError.code}] ${appError.message}`, error, context);
    return appError;
  }

  // Erreur de type inconnu
  const appError = new AppError(ErrorCode.UNKNOWN_ERROR, {
    message: String(error),
    originalError: error,
    context,
  });
  logger.error(`[${appError.code}] Unknown error type`, error, context);
  return appError;
}

/**
 * Infère le code d'erreur à partir du message d'erreur
 */
function inferErrorCode(error: Error, context?: Record<string, unknown>): AppError {
  const message = error.message.toLowerCase();

  // Erreurs réseau
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return new AppError(ErrorCode.NETWORK_ERROR, { originalError: error, context });
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return new AppError(ErrorCode.TIMEOUT, { originalError: error, context });
  }

  // Erreurs API
  if (message.includes('403') || message.includes('forbidden') || message.includes('invalide')) {
    return new AppError(ErrorCode.API_KEY_INVALID, { originalError: error, context });
  }

  if (message.includes('429') || message.includes('rate limit') || message.includes('too many')) {
    return new AppError(ErrorCode.API_RATE_LIMITED, { originalError: error, context });
  }

  if (message.includes('quota') || message.includes('limit exceeded')) {
    return new AppError(ErrorCode.API_QUOTA_EXCEEDED, { originalError: error, context });
  }

  if (message.includes('api') || message.includes('proxy') || message.includes('serper') || message.includes('gemini')) {
    return new AppError(ErrorCode.API_ERROR, {
      message: error.message,
      originalError: error,
      context,
    });
  }

  // Erreurs de stockage
  if (message.includes('indexeddb') || message.includes('storage') || message.includes('quota')) {
    return new AppError(ErrorCode.STORAGE_ERROR, { originalError: error, context });
  }

  if (message.includes('decrypt') || message.includes('déchiffr')) {
    return new AppError(ErrorCode.DECRYPTION_ERROR, { originalError: error, context });
  }

  if (message.includes('encrypt') || message.includes('chiffr')) {
    return new AppError(ErrorCode.ENCRYPTION_ERROR, { originalError: error, context });
  }

  // Erreurs d'authentification
  if (message.includes('auth') || message.includes('session') || message.includes('token')) {
    return new AppError(ErrorCode.AUTH_ERROR, { originalError: error, context });
  }

  // Erreur générique
  return new AppError(ErrorCode.UNKNOWN_ERROR, {
    message: error.message,
    originalError: error,
    context,
  });
}

/**
 * Crée une erreur à partir d'un code
 */
export function createError(
  code: ErrorCode,
  options?: {
    message?: string;
    context?: Record<string, unknown>;
  }
): AppError {
  return new AppError(code, options);
}

/**
 * Vérifie si une erreur est récupérable
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.recoverable;
  }
  return true;
}

/**
 * Obtient le message utilisateur d'une erreur
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

export default {
  AppError,
  ErrorCode,
  handleError,
  createError,
  isRecoverable,
  getUserMessage,
};
