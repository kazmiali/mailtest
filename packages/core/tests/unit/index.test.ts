/**
 * Public API tests for mailtest
 */
import { describe, it, expect } from 'vitest';
import { validate, createValidator, VERSION } from '../../src/index';

describe('mailtest setup verification', () => {
  it('should export VERSION constant', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toBe('1.0.0');
  });

  it('should export validate function', () => {
    expect(validate).toBeDefined();
    expect(typeof validate).toBe('function');
  });

  it('should export createValidator function', () => {
    expect(createValidator).toBeDefined();
    expect(typeof createValidator).toBe('function');
  });
});

describe('validate() - simple validation function', () => {
  describe('valid emails', () => {
    it('should validate valid email format', async () => {
      const result = await validate('user@example.com', {
        validators: { smtp: { enabled: false } }, // Disable SMTP for speed in tests
      });
      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@example.com');
      expect(result.score).toBeGreaterThan(0);
      expect(result.validators).toBeDefined();
    });

    it('should validate email with default configuration', async () => {
      const result = await validate('user@gmail.com', {
        validators: { smtp: { enabled: false } }, // Disable SMTP for speed in tests
      });
      expect(result.valid).toBe(true);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
    });

    it('should include all validator results', async () => {
      const result = await validate('user@gmail.com', {
        validators: { smtp: { enabled: false } }, // Disable SMTP for speed in tests
      });
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.typo).toBeDefined();
      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.mx).toBeDefined();
      // SMTP enabled by default (strict preset)
      // Note: SMTP may be undefined if it times out or fails, but it's enabled in config
    });
  });

  describe('invalid emails', () => {
    it('should reject invalid email format', async () => {
      const result = await validate('invalid-email');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('regex');
      expect(result.validators.regex?.valid).toBe(false);
    });

    it('should reject emails without @ symbol', async () => {
      const result = await validate('invalid');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('regex');
    });

    it('should reject empty string', async () => {
      const result = await validate('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('regex');
    });

    it('should reject disposable emails', async () => {
      const result = await validate('test@mailinator.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('disposable');
      expect(result.validators.disposable?.valid).toBe(false);
    });
  });

  describe('with options', () => {
    it('should accept validator options', async () => {
      const result = await validate('user@example.com', {
        validators: {
          regex: { enabled: true },
          smtp: { enabled: false },
        },
      });
      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    it('should respect earlyExit option', async () => {
      const result = await validate('invalid-email', {
        earlyExit: true,
      });
      expect(result.valid).toBe(false);
      // Should only have regex result (early exit)
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.typo).toBeUndefined();
    });

    it('should respect preset configuration', async () => {
      const result = await validate('user@gmail.com', {
        preset: 'strict',
      });
      expect(result).toBeDefined();
      // Strict preset enables SMTP which may fail for some domains
      // So we just check that the result is defined and has proper structure
      expect(result.email).toBe('user@gmail.com');
      expect(result.validators).toBeDefined();
      expect(result.validators.regex).toBeDefined();
      // SMTP should be enabled in strict preset
      expect(result.validators.smtp).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in email', async () => {
      const result = await validate('  user@example.com  ', {
        validators: { smtp: { enabled: false } }, // Disable SMTP for speed in tests
      });
      // Email normalization happens in validators, but context stores original
      // The result email should match what was passed in
      expect(result.email).toBe('  user@example.com  ');
      // But validation should still work (validators normalize internally)
      expect(result.valid).toBe(true);
    });

    it('should calculate reputation score', async () => {
      const result = await validate('user@gmail.com', {
        validators: { smtp: { enabled: false } }, // Disable SMTP for speed in tests
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should include reason when validation fails', async () => {
      const result = await validate('invalid');
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });
});

describe('createValidator() - factory function', () => {
  it('should create validator with default config', () => {
    const validator = createValidator();
    expect(validator).toBeDefined();
    expect(typeof validator.validate).toBe('function');
    expect(typeof validator.getConfig).toBe('function');
  });

  it('should create validator with custom config', () => {
    const validator = createValidator({
      validators: {
        regex: { enabled: true },
        smtp: { enabled: false },
      },
    });
    expect(validator).toBeDefined();
    expect(validator.validate).toBeDefined();
  });

  it('should create validator with preset', () => {
    const validator = createValidator({ preset: 'strict' });
    expect(validator).toBeDefined();
    const config = validator.getConfig();
    expect(config.validators.smtp.enabled).toBe(true);
    expect(config.earlyExit).toBe(true);
  });

  it('should validate emails with created validator', async () => {
    const validator = createValidator({
      validators: { smtp: { enabled: false } }, // Disable SMTP for speed in tests
    });
    const result = await validator.validate('user@example.com');
    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.email).toBe('user@example.com');
  });

  it('should use same config for multiple validations', async () => {
    const validator = createValidator({ preset: 'strict' });
    const config1 = validator.getConfig();
    const result1 = await validator.validate('user@example.com');
    const config2 = validator.getConfig();

    // Config should remain the same
    expect(config1.validators.smtp.enabled).toBe(config2.validators.smtp.enabled);
    expect(result1).toBeDefined();
  });

  it('should return config via getConfig()', () => {
    const validator = createValidator({ preset: 'balanced' });
    const config = validator.getConfig();
    expect(config).toBeDefined();
    expect(config.validators).toBeDefined();
    expect(config.validators.regex.enabled).toBe(true);
    expect(config.validators.smtp.enabled).toBe(false);
  });

  it('should handle different presets', () => {
    const strictValidator = createValidator({ preset: 'strict' });
    const balancedValidator = createValidator({ preset: 'balanced' });
    const permissiveValidator = createValidator({ preset: 'permissive' });

    expect(strictValidator.getConfig().validators.smtp.enabled).toBe(true);
    expect(balancedValidator.getConfig().validators.smtp.enabled).toBe(false);
    expect(permissiveValidator.getConfig().validators.regex.enabled).toBe(true);
  });
});
