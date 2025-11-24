/**
 * Tests for ResultFormatter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResultFormatter } from '../../../src/output/formatter';
import { createContext } from '../../../src/context';
import { ConfigManager } from '../../../src/config/config';
import type { ValidationContext } from '../../../src/context';

describe('ResultFormatter', () => {
  let formatter: ResultFormatter;
  let context: ValidationContext;

  beforeEach(() => {
    formatter = new ResultFormatter();
    const configManager = new ConfigManager();
    const config = configManager.get();
    context = createContext('user@example.com', config);
  });

  describe('format()', () => {
    it('should format valid email with all validators passing', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
        typo: { valid: true, validator: 'typo' },
        disposable: { valid: true, validator: 'disposable' },
        mx: { valid: true, validator: 'mx' },
        smtp: { valid: true, validator: 'smtp' },
      };

      const result = formatter.format(context);

      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@example.com');
      expect(result.score).toBe(100);
      expect(result.reason).toBeUndefined();
      expect(result.validators).toHaveProperty('regex');
      expect(result.validators).toHaveProperty('typo');
      expect(result.validators).toHaveProperty('disposable');
      expect(result.validators).toHaveProperty('mx');
      expect(result.validators).toHaveProperty('smtp');
    });

    it('should format invalid email with regex failure', () => {
      context.results = {
        regex: {
          valid: false,
          validator: 'regex',
          error: {
            code: 'REGEX_INVALID_FORMAT',
            message: 'Invalid email format',
            severity: 'error',
          },
        },
      };

      const result = formatter.format(context);

      expect(result.valid).toBe(false);
      expect(result.email).toBe('user@example.com');
      expect(result.score).toBe(0);
      expect(result.reason).toBe('regex');
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
    });

    it('should include metadata by default', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
      };

      const result = formatter.format(context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
      expect(result.metadata?.duration).toBeDefined();
      expect(typeof result.metadata?.timestamp).toBe('string');
      expect(typeof result.metadata?.duration).toBe('number');
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should exclude metadata when includeMetadata is false', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
      };

      const result = formatter.format(context, false);

      expect(result.metadata).toBeUndefined();
    });

    it('should calculate score correctly for partial validation', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
        typo: { valid: true, validator: 'typo' },
        disposable: { valid: true, validator: 'disposable' },
        // mx and smtp not run
      };

      const result = formatter.format(context);

      expect(result.score).toBe(50); // 20 + 10 + 20 = 50
    });

    it('should handle typo warnings without failing validation', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
        typo: {
          valid: false,
          validator: 'typo',
          error: {
            code: 'TYPO_DETECTED',
            message: 'Possible typo detected',
            severity: 'warning',
          },
        },
        disposable: { valid: true, validator: 'disposable' },
      };

      const result = formatter.format(context);

      expect(result.valid).toBe(true); // Typo warnings don't fail validation
      expect(result.score).toBe(40); // 20 + 0 + 20 = 40 (typo doesn't contribute)
      expect(result.reason).toBeUndefined();
    });

    it('should set reason to first failing validator', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
        typo: { valid: true, validator: 'typo' },
        disposable: {
          valid: false,
          validator: 'disposable',
          error: {
            code: 'DISPOSABLE_DOMAIN',
            message: 'Disposable email domain',
            severity: 'error',
          },
        },
        mx: {
          valid: false,
          validator: 'mx',
          error: {
            code: 'MX_NOT_FOUND',
            message: 'No MX records found',
            severity: 'error',
          },
        },
      };

      const result = formatter.format(context);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('disposable'); // First failing validator
    });

    it('should include custom validator results', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
        customValidator: {
          valid: true,
          validator: 'customValidator',
          details: { custom: 'data' },
        },
      };

      const result = formatter.format(context);

      expect(result.validators.customValidator).toBeDefined();
      expect(result.validators.customValidator?.valid).toBe(true);
    });

    it('should handle empty results', () => {
      context.results = {};

      const result = formatter.format(context);

      expect(result.valid).toBe(true); // No failures = valid
      expect(result.score).toBe(0); // No validators = 0 score
      expect(result.validators).toEqual({});
    });

    it('should format timestamp as ISO 8601 string', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
      };

      const result = formatter.format(context);

      expect(result.metadata?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Verify it's a valid ISO date
      expect(() => new Date(result.metadata?.timestamp ?? '')).not.toThrow();
    });

    it('should calculate duration correctly', async () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
      };

      // Add a small delay to test duration calculation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = formatter.format(context);

      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
      // Duration should be at least the delay we added
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(5);
    });

    it('should handle score calculation with all validators', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' }, // 20 points
        typo: { valid: true, validator: 'typo' }, // 10 points
        disposable: { valid: true, validator: 'disposable' }, // 20 points
        mx: { valid: true, validator: 'mx' }, // 20 points
        smtp: { valid: true, validator: 'smtp' }, // 30 points
      };

      const result = formatter.format(context);

      expect(result.score).toBe(100); // 20 + 10 + 20 + 20 + 30 = 100
    });

    it('should cap score at 100', () => {
      // This test ensures score doesn't exceed 100 even if more validators pass
      context.results = {
        regex: { valid: true, validator: 'regex' },
        typo: { valid: true, validator: 'typo' },
        disposable: { valid: true, validator: 'disposable' },
        mx: { valid: true, validator: 'mx' },
        smtp: { valid: true, validator: 'smtp' },
      };

      const result = formatter.format(context);

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should ensure score is at least 0', () => {
      context.results = {
        regex: { valid: false, validator: 'regex' },
        typo: { valid: false, validator: 'typo' },
        disposable: { valid: false, validator: 'disposable' },
        mx: { valid: false, validator: 'mx' },
        smtp: { valid: false, validator: 'smtp' },
      };

      const result = formatter.format(context);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBe(0);
    });

    it('should only include validators that have results', () => {
      context.results = {
        regex: { valid: true, validator: 'regex' },
        // typo, disposable, mx, smtp not included
      };

      const result = formatter.format(context);

      expect(result.validators.regex).toBeDefined();
      expect(result.validators.typo).toBeUndefined();
      expect(result.validators.disposable).toBeUndefined();
      expect(result.validators.mx).toBeUndefined();
      expect(result.validators.smtp).toBeUndefined();
    });

    it('should preserve validator result details', () => {
      context.results = {
        regex: {
          valid: true,
          validator: 'regex',
          details: { mode: 'strict' },
        },
        mx: {
          valid: true,
          validator: 'mx',
          details: {
            records: [{ exchange: 'mail.example.com', priority: 10 }],
            quality: 20,
          },
        },
      };

      const result = formatter.format(context);

      expect(result.validators.regex?.details).toEqual({ mode: 'strict' });
      expect(result.validators.mx?.details).toEqual({
        records: [{ exchange: 'mail.example.com', priority: 10 }],
        quality: 20,
      });
    });

    it('should preserve error details in validator results', () => {
      context.results = {
        regex: {
          valid: false,
          validator: 'regex',
          error: {
            code: 'REGEX_INVALID_FORMAT',
            message: 'Invalid email format',
            severity: 'error',
            suggestion: 'Check email format',
            details: { position: 5 },
          },
        },
      };

      const result = formatter.format(context);

      expect(result.validators.regex?.error).toBeDefined();
      expect(result.validators.regex?.error?.code).toBe('REGEX_INVALID_FORMAT');
      expect(result.validators.regex?.error?.message).toBe('Invalid email format');
      expect(result.validators.regex?.error?.severity).toBe('error');
      expect(result.validators.regex?.error?.suggestion).toBe('Check email format');
      expect(result.validators.regex?.error?.details).toEqual({ position: 5 });
    });
  });
});
