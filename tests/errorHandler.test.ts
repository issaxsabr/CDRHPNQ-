import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  ErrorCode,
  handleError,
  createError,
  isRecoverable,
  getUserMessage,
} from '../services/errorHandler';

describe('AppError', () => {
  it('should create error with code and default message', () => {
    const error = new AppError(ErrorCode.NETWORK_ERROR);

    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.userMessage).toBe('Problème de connexion. Vérifiez votre connexion internet.');
    expect(error.recoverable).toBe(true);
  });

  it('should create error with custom message', () => {
    const error = new AppError(ErrorCode.API_ERROR, {
      message: 'Custom technical message',
      userMessage: 'Message personnalisé pour l\'utilisateur',
    });

    expect(error.message).toBe('Custom technical message');
    expect(error.userMessage).toBe('Message personnalisé pour l\'utilisateur');
  });

  it('should create non-recoverable error', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, {
      recoverable: false,
    });

    expect(error.recoverable).toBe(false);
  });

  it('should preserve original error', () => {
    const originalError = new Error('Original error');
    const error = new AppError(ErrorCode.API_ERROR, {
      originalError,
    });

    expect(error.originalError).toBe(originalError);
  });
});

describe('handleError', () => {
  it('should return AppError unchanged', () => {
    const originalError = new AppError(ErrorCode.NETWORK_ERROR);
    const result = handleError(originalError);

    expect(result).toBe(originalError);
  });

  it('should convert network error to NETWORK_ERROR', () => {
    const error = new Error('Failed to fetch');
    const result = handleError(error);

    expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('should convert 403 error to API_KEY_INVALID', () => {
    const error = new Error('Request failed with status 403');
    const result = handleError(error);

    expect(result.code).toBe(ErrorCode.API_KEY_INVALID);
  });

  it('should convert timeout error to TIMEOUT', () => {
    const error = new Error('Request timed out');
    const result = handleError(error);

    expect(result.code).toBe(ErrorCode.TIMEOUT);
  });

  it('should handle unknown error types', () => {
    const result = handleError('string error');

    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('string error');
  });
});

describe('createError', () => {
  it('should create error with specified code', () => {
    const error = createError(ErrorCode.VALIDATION_ERROR, {
      message: 'Invalid input',
    });

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe('Invalid input');
  });
});

describe('isRecoverable', () => {
  it('should return true for recoverable AppError', () => {
    const error = new AppError(ErrorCode.NETWORK_ERROR);
    expect(isRecoverable(error)).toBe(true);
  });

  it('should return false for non-recoverable AppError', () => {
    const error = new AppError(ErrorCode.UNKNOWN_ERROR, { recoverable: false });
    expect(isRecoverable(error)).toBe(false);
  });

  it('should return true for regular Error', () => {
    const error = new Error('Regular error');
    expect(isRecoverable(error)).toBe(true);
  });
});

describe('getUserMessage', () => {
  it('should return userMessage from AppError', () => {
    const error = new AppError(ErrorCode.NETWORK_ERROR);
    const message = getUserMessage(error);

    expect(message).toBe('Problème de connexion. Vérifiez votre connexion internet.');
  });

  it('should return message from regular Error', () => {
    const error = new Error('Some error message');
    const message = getUserMessage(error);

    expect(message).toBe('Some error message');
  });

  it('should return default message for unknown types', () => {
    const message = getUserMessage(null);

    expect(message).toBe('Une erreur inattendue est survenue.');
  });
});
