import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../../src/config/config';

describe('ConfigManager', () => {
  describe('default configuration', () => {
    it('should use default configuration when no config provided', () => {
      const config = new ConfigManager();
      const merged = config.get();

      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(true);
      expect(merged.validators.disposable.enabled).toBe(true);
      expect(merged.validators.mx.enabled).toBe(true);
      expect(merged.validators.smtp.enabled).toBe(false); // Disabled by default
      expect(merged.earlyExit).toBe(false);
    });
  });

  describe('config merging', () => {
    it('should merge user config with defaults', () => {
      const config = new ConfigManager({
        validators: { smtp: { enabled: false } },
      });

      const merged = config.get();

      // User config overrides default
      expect(merged.validators.smtp.enabled).toBe(false);

      // Defaults still apply for other validators
      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(true);
      expect(merged.validators.disposable.enabled).toBe(true);
      expect(merged.validators.mx.enabled).toBe(true);
    });

    it('should merge multiple validator configs', () => {
      const config = new ConfigManager({
        validators: {
          regex: { enabled: false },
          typo: { enabled: false },
          smtp: { enabled: true },
        },
      });

      const merged = config.get();

      expect(merged.validators.regex.enabled).toBe(false);
      expect(merged.validators.typo.enabled).toBe(false);
      expect(merged.validators.smtp.enabled).toBe(true);
      // Others keep defaults
      expect(merged.validators.disposable.enabled).toBe(true);
      expect(merged.validators.mx.enabled).toBe(true);
    });

    it('should merge earlyExit option', () => {
      const config = new ConfigManager({
        earlyExit: true,
      });

      const merged = config.get();
      expect(merged.earlyExit).toBe(true);
    });

    it('should merge timeout option', () => {
      const config = new ConfigManager({
        timeout: 5000,
      });

      const merged = config.get();
      expect(merged.timeout).toBe(5000);
    });
  });

  describe('preset configurations', () => {
    it('should load strict preset', () => {
      const config = new ConfigManager({ preset: 'strict' });
      const merged = config.get();

      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(true);
      expect(merged.validators.disposable.enabled).toBe(true);
      expect(merged.validators.mx.enabled).toBe(true);
      expect(merged.validators.smtp.enabled).toBe(true); // Enabled in strict
      expect(merged.earlyExit).toBe(true);
    });

    it('should load balanced preset', () => {
      const config = new ConfigManager({ preset: 'balanced' });
      const merged = config.get();

      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(true);
      expect(merged.validators.disposable.enabled).toBe(true);
      expect(merged.validators.mx.enabled).toBe(true);
      expect(merged.validators.smtp.enabled).toBe(false); // Disabled in balanced
      expect(merged.earlyExit).toBe(false);
    });

    it('should load permissive preset', () => {
      const config = new ConfigManager({ preset: 'permissive' });
      const merged = config.get();

      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(false);
      expect(merged.validators.disposable.enabled).toBe(false);
      expect(merged.validators.mx.enabled).toBe(false);
      expect(merged.validators.smtp.enabled).toBe(false);
      expect(merged.earlyExit).toBe(true);
    });
  });

  describe('preset with user overrides', () => {
    it('should allow user config to override preset', () => {
      const config = new ConfigManager({
        preset: 'strict',
        validators: {
          smtp: { enabled: false }, // Override preset
        },
      });

      const merged = config.get();

      // Preset values
      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(true);
      expect(merged.earlyExit).toBe(true);

      // User override
      expect(merged.validators.smtp.enabled).toBe(false);
    });

    it('should allow user config to override preset earlyExit', () => {
      const config = new ConfigManager({
        preset: 'strict',
        earlyExit: false, // Override preset
      });

      const merged = config.get();
      expect(merged.earlyExit).toBe(false);
    });
  });

  describe('boolean validator configs', () => {
    it('should normalize boolean true to config object', () => {
      const config = new ConfigManager({
        validators: {
          regex: true,
          smtp: false,
        },
      });

      const merged = config.get();
      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.smtp.enabled).toBe(false);
    });

    it('should handle mixed boolean and config objects', () => {
      const config = new ConfigManager({
        validators: {
          regex: true,
          typo: { enabled: false },
          smtp: false,
        },
      });

      const merged = config.get();
      expect(merged.validators.regex.enabled).toBe(true);
      expect(merged.validators.typo.enabled).toBe(false);
      expect(merged.validators.smtp.enabled).toBe(false);
    });
  });

  describe('config validation', () => {
    it('should throw error for invalid timeout', () => {
      expect(() => {
        new ConfigManager({
          timeout: -1000,
        });
      }).toThrow('Invalid configuration');
    });

    it('should throw error for invalid preset', () => {
      expect(() => {
        new ConfigManager({
          preset: 'invalid-preset' as unknown as 'strict',
        });
      }).toThrow();
    });
  });

  describe('getValue method', () => {
    it('should get nested configuration value', () => {
      const config = new ConfigManager({
        validators: { smtp: { enabled: true } },
      });

      expect(config.getValue<boolean>('validators.smtp.enabled')).toBe(true);
      expect(config.getValue<boolean>('validators.regex.enabled')).toBe(true);
      expect(config.getValue<boolean>('earlyExit')).toBe(false);
    });

    it('should throw error for non-existent key', () => {
      const config = new ConfigManager();

      expect(() => {
        config.getValue('validators.nonexistent.enabled');
      }).toThrow('Configuration key "validators.nonexistent.enabled" not found');
    });
  });

  describe('isValidatorEnabled method', () => {
    it('should return true for enabled validator', () => {
      const config = new ConfigManager({
        validators: { regex: { enabled: true } },
      });

      expect(config.isValidatorEnabled('regex')).toBe(true);
    });

    it('should return false for disabled validator', () => {
      const config = new ConfigManager({
        validators: { smtp: { enabled: false } },
      });

      expect(config.isValidatorEnabled('smtp')).toBe(false);
    });

    it('should return false for non-existent validator', () => {
      const config = new ConfigManager();

      expect(config.isValidatorEnabled('nonexistent')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty validators object', () => {
      const config = new ConfigManager({
        validators: {},
      });

      const merged = config.get();
      // Should still have default validators
      expect(merged.validators.regex.enabled).toBe(true);
    });

    it('should handle undefined timeout', () => {
      const config = new ConfigManager({
        timeout: undefined,
      });

      const merged = config.get();
      expect(merged.timeout).toBeUndefined();
    });

    it('should handle custom validator names', () => {
      const config = new ConfigManager({
        validators: {
          custom: { enabled: true },
        },
      });

      const merged = config.get();
      expect(merged.validators.custom.enabled).toBe(true);
    });
  });
});


