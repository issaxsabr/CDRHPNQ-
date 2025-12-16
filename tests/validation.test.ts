import { describe, it, expect } from 'vitest';
import {
  validateAndSanitize,
  validateBusinessData,
  safeValidateBusinessData,
  sanitizeBusinessData,
  getValidationErrorMessage,
} from '../utils/validation';
import { z } from 'zod';

describe('validateAndSanitize', () => {
  describe('name field', () => {
    it('should validate a valid name', () => {
      const result = validateAndSanitize('name', 'Entreprise ABC');
      expect(result).toEqual({ name: 'Entreprise ABC' });
    });

    it('should trim whitespace from name', () => {
      const result = validateAndSanitize('name', '  Entreprise ABC  ');
      expect(result).toEqual({ name: 'Entreprise ABC' });
    });

    it('should reject empty name', () => {
      expect(() => validateAndSanitize('name', '')).toThrow();
    });

    it('should sanitize XSS in name', () => {
      const result = validateAndSanitize('name', '<script>alert("xss")</script>Test');
      expect(result.name).not.toContain('<script>');
      expect(result.name).toContain('Test');
    });
  });

  describe('email field', () => {
    it('should validate a valid email', () => {
      const result = validateAndSanitize('email', 'test@example.com');
      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should reject invalid email', () => {
      expect(() => validateAndSanitize('email', 'invalid-email')).toThrow();
    });

    it('should allow empty email', () => {
      const result = validateAndSanitize('email', '');
      expect(result).toEqual({ email: '' });
    });
  });

  describe('phone field', () => {
    it('should validate a valid phone number', () => {
      const result = validateAndSanitize('phone', '514-555-1234');
      expect(result).toEqual({ phone: '514-555-1234' });
    });

    it('should validate phone with country code', () => {
      const result = validateAndSanitize('phone', '+1 514 555 1234');
      expect(result).toEqual({ phone: '+1 514 555 1234' });
    });

    it('should allow empty phone', () => {
      const result = validateAndSanitize('phone', '');
      expect(result).toEqual({ phone: '' });
    });
  });

  describe('website field', () => {
    it('should validate a valid URL with https', () => {
      const result = validateAndSanitize('website', 'https://example.com');
      expect(result).toEqual({ website: 'https://example.com' });
    });

    it('should add https to URL without protocol', () => {
      const result = validateAndSanitize('website', 'example.com');
      expect(result).toEqual({ website: 'https://example.com' });
    });

    it('should allow empty website', () => {
      const result = validateAndSanitize('website', '');
      expect(result).toEqual({ website: '' });
    });
  });

  describe('customField field', () => {
    it('should validate customField', () => {
      const result = validateAndSanitize('customField', 'Note personnalisée');
      expect(result).toEqual({ customField: 'Note personnalisée' });
    });

    it('should reject customField exceeding max length', () => {
      const longText = 'a'.repeat(501);
      expect(() => validateAndSanitize('customField', longText)).toThrow();
    });
  });
});

describe('sanitizeBusinessData', () => {
  it('should sanitize all text fields', () => {
    const data = {
      name: '<script>alert("xss")</script>Test Company',
      status: 'En activité',
      address: '123 Rue Test',
      phone: '514-555-1234',
      hours: 'Lun-Ven 9h-17h',
    };

    const result = sanitizeBusinessData(data as any);
    expect(result.name).not.toContain('<script>');
    expect(result.status).toBe('En activité');
  });
});

describe('getValidationErrorMessage', () => {
  it('should return formatted error message', () => {
    const schema = z.object({
      name: z.string().min(1, 'Le nom est requis'),
    });

    try {
      schema.parse({ name: '' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = getValidationErrorMessage(error);
        expect(message).toContain('name');
        expect(message).toContain('Le nom est requis');
      }
    }
  });
});

describe('safeValidateBusinessData', () => {
  it('should return success false for invalid data', () => {
    const result = safeValidateBusinessData({ invalid: 'data' });
    expect(result.success).toBe(false);
  });
});
