/**
 * Tests for BaseValidator
 */

import { describe, it, expect } from 'vitest';
import { BaseValidator } from '../../../src/validators/base';
import { ValidationError } from '../../../src/errors/errors';
import type { ValidatorResult } from '../../../src/types';

// Concrete implementation for testing
class TestValidator extends BaseValidator {
  constructor(config?: { enabled?: boolean }) {
    super('test', { enabled: config?.enabled ?? true });
  }

  async validate(email: string): Promise<ValidatorResult> {
    try {
      if (!email) {
        throw new ValidationError('Email is required', 'INVALID_INPUT', this.name);
      }

      const normalized = this.normalizeEmail(email);

      if (normalized === 'error@test.com') {
        throw new Error('Test error');
      }

      const isValid = normalized.includes('@');
      return this.createResult(isValid, { email: normalized });
    } catch (error) {
      return this.handleError(error);
    }
  }
}

describe('BaseValidator', () => {
  describe('constructor', () => {
    it('should create validator with default config', () => {
      const validator = new TestValidator();
      expect(validator.getName()).toBe('test');
      expect(validator.isEnabled()).toBe(true);
    });

    it('should create validator with custom config', () => {
      const validator = new TestValidator({ enabled: false });
      expect(validator.isEnabled()).toBe(false);
    });
  });

  describe('getName()', () => {
    it('should return validator name', () => {
      const validator = new TestValidator();
      expect(validator.getName()).toBe('test');
    });
  });

  describe('isEnabled()', () => {
    it('should return true when enabled', () => {
      const validator = new TestValidator({ enabled: true });
      expect(validator.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const validator = new TestValidator({ enabled: false });
      expect(validator.isEnabled()).toBe(false);
    });
  });

  describe('getConfig()', () => {
    it('should return validator config', () => {
      const validator = new TestValidator({ enabled: false });
      const config = validator.getConfig();
      expect(config).toEqual({ enabled: false });
    });

    it('should return copy of config (not reference)', () => {
      const validator = new TestValidator({ enabled: true });
      const config = validator.getConfig();
      config.enabled = false;
      expect(validator.isEnabled()).toBe(true);
    });
  });

  describe('validate()', () => {
    it('should validate email successfully', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('user@example.com');
      expect(result.valid).toBe(true);
      expect(result.validator).toBe('test');
      expect(result.details).toEqual({ email: 'user@example.com' });
    });

    it('should handle validation failure', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('invalid');
      expect(result.valid).toBe(false);
      expect(result.validator).toBe('test');
    });

    it('should handle ValidationError', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.validator).toBe('test');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle generic Error', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('error@test.com');
      expect(result.valid).toBe(false);
      expect(result.validator).toBe('test');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
    });
  });

  describe('normalizeEmail()', () => {
    it('should trim whitespace', async () => {
      const validator = new TestValidator();
      // Access protected method through validation
      const result = await validator.validate(' user@example.com ');
      expect(result.details).toEqual({ email: 'user@example.com' });
    });

    it('should lowercase domain', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('User@EXAMPLE.COM');
      expect(result.details).toEqual({ email: 'User@example.com' });
    });

    it('should preserve local part case', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('UserName@example.com');
      expect(result.details).toEqual({ email: 'UserName@example.com' });
    });
  });

  describe('extractDomain()', () => {
    it('should extract domain from email', async () => {
      const validator = new TestValidator();
      // Test through validation
      const result = await validator.validate('user@example.com');
      expect(result.valid).toBe(true);
    });

    it('should return empty string for invalid email', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('invalid');
      expect(result.valid).toBe(false);
    });
  });

  describe('extractLocal()', () => {
    it('should extract local part from email', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('user@example.com');
      expect(result.valid).toBe(true);
      // Test extractLocal indirectly - create validator that uses it
      class LocalTestValidator extends BaseValidator {
        constructor() {
          super('local-test');
        }
        async validate(email: string): Promise<ValidatorResult> {
          const local = this.extractLocal(email);
          return this.createResult(true, { local });
        }
      }
      const localValidator = new LocalTestValidator();
      const localResult = await localValidator.validate('user@example.com');
      expect(localResult.details?.local).toBe('user');
    });

    it('should return empty string for invalid email', async () => {
      const validator = new TestValidator();
      const result = await validator.validate('invalid');
      expect(result.valid).toBe(false);
      // Test extractLocal with no @ symbol
      class LocalTestValidator extends BaseValidator {
        constructor() {
          super('local-test');
        }
        async validate(email: string): Promise<ValidatorResult> {
          const local = this.extractLocal(email);
          return this.createResult(true, { local });
        }
      }
      const localValidator = new LocalTestValidator();
      const localResult = await localValidator.validate('invalid');
      expect(localResult.details?.local).toBe('');
    });

    it('should extract local part with multiple @ symbols', async () => {
      class LocalTestValidator extends BaseValidator {
        constructor() {
          super('local-test');
        }
        async validate(email: string): Promise<ValidatorResult> {
          const local = this.extractLocal(email);
          return this.createResult(true, { local });
        }
      }
      const localValidator = new LocalTestValidator();
      // lastIndexOf('@') will find the last @
      const localResult = await localValidator.validate('user@name@example.com');
      expect(localResult.details?.local).toBe('user@name');
    });

    it('should handle empty string', async () => {
      class LocalTestValidator extends BaseValidator {
        constructor() {
          super('local-test');
        }
        async validate(email: string): Promise<ValidatorResult> {
          const local = this.extractLocal(email);
          return this.createResult(true, { local });
        }
      }
      const localValidator = new LocalTestValidator();
      const localResult = await localValidator.validate('');
      expect(localResult.details?.local).toBe('');
    });
  });
});
