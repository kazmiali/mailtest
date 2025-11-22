import { describe, it, expect } from 'vitest';
import {
  validationErrorSchema,
  validatorResultSchema,
  validatorConfigSchema,
  validatorOptionsSchema,
  validationResultSchema,
  presetSchema,
  configSchema,
} from '../../src/schemas';
import { ErrorCode } from '../../src/types';

describe('Validation Schemas', () => {
  describe('validationErrorSchema', () => {
    it('should validate a valid validation error', () => {
      const error = {
        code: ErrorCode.REGEX_INVALID_FORMAT,
        message: 'Invalid email format',
        suggestion: 'Check your email address',
        severity: 'error' as const,
        validator: 'regex',
      };

      const result = validationErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(error);
      }
    });

    it('should validate error with optional fields missing', () => {
      const error = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error occurred',
        severity: 'critical' as const,
      };

      const result = validationErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should reject error with empty message', () => {
      const error = {
        code: ErrorCode.INVALID_CONFIG,
        message: '',
        severity: 'error' as const,
      };

      const result = validationErrorSchema.safeParse(error);
      expect(result.success).toBe(false);
    });

    it('should accept custom error code string', () => {
      const error = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error',
        severity: 'warning' as const,
      };

      const result = validationErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });

  describe('validatorResultSchema', () => {
    it('should validate a valid validator result', () => {
      const result = {
        valid: true,
        validator: 'regex',
      };

      const parsed = validatorResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate validator result with error', () => {
      const result = {
        valid: false,
        validator: 'regex',
        error: {
          code: ErrorCode.REGEX_INVALID_FORMAT,
          message: 'Invalid format',
          severity: 'error' as const,
        },
      };

      const parsed = validatorResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate validator result with details', () => {
      const result = {
        valid: true,
        validator: 'mx',
        details: {
          records: [{ exchange: 'mail.example.com', priority: 10 }],
        },
      };

      const parsed = validatorResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should reject result with empty validator name', () => {
      const result = {
        valid: true,
        validator: '',
      };

      const parsed = validatorResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('validatorConfigSchema', () => {
    it('should validate enabled validator config', () => {
      const config = { enabled: true };
      const parsed = validatorConfigSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('should validate disabled validator config', () => {
      const config = { enabled: false };
      const parsed = validatorConfigSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('should reject config without enabled field', () => {
      const config = {};
      const parsed = validatorConfigSchema.safeParse(config);
      expect(parsed.success).toBe(false);
    });
  });

  describe('validatorOptionsSchema', () => {
    it('should validate valid email with options', () => {
      const options = {
        email: 'user@example.com',
        validators: {
          regex: { enabled: true },
          smtp: false,
        },
        earlyExit: true,
        timeout: 5000,
      };

      const parsed = validatorOptionsSchema.safeParse(options);
      expect(parsed.success).toBe(true);
    });

    it('should validate minimal options with just email', () => {
      const options = {
        email: 'user@example.com',
      };

      const parsed = validatorOptionsSchema.safeParse(options);
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const options = {
        email: 'not-an-email',
      };

      const parsed = validatorOptionsSchema.safeParse(options);
      expect(parsed.success).toBe(false);
    });

    it('should reject negative timeout', () => {
      const options = {
        email: 'user@example.com',
        timeout: -1000,
      };

      const parsed = validatorOptionsSchema.safeParse(options);
      expect(parsed.success).toBe(false);
    });

    it('should reject non-integer timeout', () => {
      const options = {
        email: 'user@example.com',
        timeout: 1000.5,
      };

      const parsed = validatorOptionsSchema.safeParse(options);
      expect(parsed.success).toBe(false);
    });

    it('should accept validator config as boolean', () => {
      const options = {
        email: 'user@example.com',
        validators: {
          regex: true,
          smtp: false,
        },
      };

      const parsed = validatorOptionsSchema.safeParse(options);
      expect(parsed.success).toBe(true);
    });
  });

  describe('validationResultSchema', () => {
    it('should validate a valid validation result', () => {
      const result = {
        valid: true,
        email: 'user@example.com',
        score: 95,
        validators: {
          regex: {
            valid: true,
            validator: 'regex',
          },
        },
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate result with all validators', () => {
      const result = {
        valid: true,
        email: 'user@example.com',
        score: 85,
        reason: 'regex' as const,
        validators: {
          regex: { valid: true, validator: 'regex' },
          typo: { valid: true, validator: 'typo' },
          disposable: { valid: true, validator: 'disposable' },
          mx: { valid: true, validator: 'mx' },
          smtp: { valid: true, validator: 'smtp' },
        },
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate result with failure reason', () => {
      const result = {
        valid: false,
        email: 'invalid@example.com',
        score: 20,
        reason: 'disposable' as const,
        validators: {
          regex: { valid: true, validator: 'regex' },
          disposable: {
            valid: false,
            validator: 'disposable',
            error: {
              code: ErrorCode.DISPOSABLE_DOMAIN,
              message: 'Disposable email not allowed',
              severity: 'error' as const,
            },
          },
        },
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should reject result with invalid email', () => {
      const result = {
        valid: true,
        email: 'not-an-email',
        score: 50,
        validators: {},
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });

    it('should reject result with score out of range', () => {
      const result = {
        valid: true,
        email: 'user@example.com',
        score: 150,
        validators: {},
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });

    it('should reject result with negative score', () => {
      const result = {
        valid: true,
        email: 'user@example.com',
        score: -10,
        validators: {},
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });

    it('should reject invalid reason', () => {
      const result = {
        valid: false,
        email: 'user@example.com',
        score: 50,
        reason: 'invalid-reason' as unknown as 'regex',
        validators: {},
      };

      const parsed = validationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('presetSchema', () => {
    it('should validate strict preset', () => {
      const parsed = presetSchema.safeParse('strict');
      expect(parsed.success).toBe(true);
    });

    it('should validate balanced preset', () => {
      const parsed = presetSchema.safeParse('balanced');
      expect(parsed.success).toBe(true);
    });

    it('should validate permissive preset', () => {
      const parsed = presetSchema.safeParse('permissive');
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid preset', () => {
      const parsed = presetSchema.safeParse('invalid');
      expect(parsed.success).toBe(false);
    });
  });

  describe('configSchema', () => {
    it('should validate config with preset', () => {
      const config = {
        preset: 'strict' as const,
      };

      const parsed = configSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('should validate config with validators', () => {
      const config = {
        validators: {
          regex: { enabled: true },
          smtp: false,
        },
        earlyExit: true,
        timeout: 10000,
      };

      const parsed = configSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('should validate minimal config', () => {
      const config = {};

      const parsed = configSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid timeout', () => {
      const config = {
        timeout: -1000,
      };

      const parsed = configSchema.safeParse(config);
      expect(parsed.success).toBe(false);
    });
  });
});
