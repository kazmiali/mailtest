import { describe, it, expect, beforeEach } from 'vitest';
import { createContext, type ValidationContext } from '../../src/context';
import { ConfigManager } from '../../src/config/config';

describe('ValidationContext', () => {
  let config: ReturnType<ConfigManager['get']>;
  let email: string;

  beforeEach(() => {
    const configManager = new ConfigManager();
    config = configManager.get();
    email = 'user@example.com';
  });

  describe('createContext', () => {
    it('should create a validation context with email and config', () => {
      const context = createContext(email, config);

      expect(context.email).toBe(email);
      expect(context.config).toBe(config);
      expect(context.results).toEqual({});
      expect(typeof context.startTime).toBe('number');
    });

    it('should initialize empty results object', () => {
      const context = createContext(email, config);

      expect(context.results).toEqual({});
      expect(context.results.regex).toBeUndefined();
      expect(context.results.typo).toBeUndefined();
      expect(context.results.disposable).toBeUndefined();
      expect(context.results.mx).toBeUndefined();
      expect(context.results.smtp).toBeUndefined();
    });

    it('should set startTime to current timestamp', () => {
      const before = Date.now();
      const context = createContext(email, config);
      const after = Date.now();

      expect(context.startTime).toBeGreaterThanOrEqual(before);
      expect(context.startTime).toBeLessThanOrEqual(after);
    });

    it('should create context with different email addresses', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@test.com';

      const context1 = createContext(email1, config);
      const context2 = createContext(email2, config);

      expect(context1.email).toBe(email1);
      expect(context2.email).toBe(email2);
      expect(context1.email).not.toBe(context2.email);
    });

    it('should create context with different configurations', () => {
      const strictConfig = new ConfigManager({ preset: 'strict' }).get();
      const permissiveConfig = new ConfigManager({ preset: 'permissive' }).get();

      const context1 = createContext(email, strictConfig);
      const context2 = createContext(email, permissiveConfig);

      expect(context1.config.earlyExit).toBe(true); // Strict preset
      expect(context2.config.earlyExit).toBe(true); // Permissive preset
      expect(context1.config.validators.smtp.enabled).toBe(true); // Strict
      expect(context2.config.validators.smtp.enabled).toBe(false); // Permissive
    });

    it('should allow storing validator results in results object', () => {
      const context = createContext(email, config);

      // Simulate storing validator results
      context.results.regex = {
        valid: true,
        validator: 'regex',
      };

      context.results.typo = {
        valid: false,
        validator: 'typo',
        error: {
          code: 'TYPO_DETECTED',
          message: 'Possible typo detected',
          severity: 'warning',
        },
      };

      expect(context.results.regex?.valid).toBe(true);
      expect(context.results.typo?.valid).toBe(false);
      expect(context.results.typo?.error?.code).toBe('TYPO_DETECTED');
    });

    it('should support custom validator results', () => {
      const context = createContext(email, config);

      context.results['custom-validator'] = {
        valid: true,
        validator: 'custom-validator',
        details: { customField: 'value' },
      };

      expect(context.results['custom-validator']?.valid).toBe(true);
      expect(context.results['custom-validator']?.details).toEqual({
        customField: 'value',
      });
    });

    it('should maintain reference to original config object', () => {
      const context = createContext(email, config);

      expect(context.config).toBe(config);
      expect(context.config.validators.regex.enabled).toBe(config.validators.regex.enabled);
    });
  });

  describe('ValidationContext interface', () => {
    it('should have all required properties', () => {
      const context = createContext(email, config);

      expect(context).toHaveProperty('email');
      expect(context).toHaveProperty('config');
      expect(context).toHaveProperty('results');
      expect(context).toHaveProperty('startTime');
    });

    it('should have correct types for all properties', () => {
      const context: ValidationContext = createContext(email, config);

      expect(typeof context.email).toBe('string');
      expect(typeof context.config).toBe('object');
      expect(typeof context.results).toBe('object');
      expect(typeof context.startTime).toBe('number');
    });
  });
});
