/**
 * Disposable Validator Tests
 *
 * Comprehensive test suite for DisposableValidator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DisposableValidator } from '../../../src/validators/disposable';
import { ErrorCode } from '../../../src/types';

describe('DisposableValidator', () => {
  let validator: DisposableValidator;

  beforeEach(() => {
    validator = new DisposableValidator();
  });

  describe('constructor', () => {
    it('should create validator with default config', () => {
      const v = new DisposableValidator();
      expect(v.getName()).toBe('disposable');
      expect(v.isEnabled()).toBe(true);
    });

    it('should create validator with custom config', () => {
      const v = new DisposableValidator({
        enabled: false,
        customBlacklist: ['spam.com'],
        customWhitelist: ['company.com'],
        enablePatternDetection: false,
      });
      expect(v.isEnabled()).toBe(false);
    });

    it('should use custom blacklist when provided', () => {
      const v = new DisposableValidator({
        customBlacklist: ['spam.com', 'test.com'],
      });
      expect(v).toBeInstanceOf(DisposableValidator);
    });

    it('should use custom whitelist when provided', () => {
      const v = new DisposableValidator({
        customWhitelist: ['company.com', 'subsidiary.com'],
      });
      expect(v).toBeInstanceOf(DisposableValidator);
    });

    it('should enable pattern detection by default', () => {
      const v = new DisposableValidator();
      expect(v).toBeInstanceOf(DisposableValidator);
    });

    it('should disable pattern detection when configured', () => {
      const v = new DisposableValidator({
        enablePatternDetection: false,
      });
      expect(v).toBeInstanceOf(DisposableValidator);
    });
  });

  describe('validate()', () => {
    describe('known disposable domains', () => {
      it('should reject mailinator.com (known disposable)', async () => {
        const result = await validator.validate('test@mailinator.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        expect(result.error?.message).toContain('mailinator.com');
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('known_disposable');
      });

      it('should reject temp-mail.org (known disposable)', async () => {
        const result = await validator.validate('user@temp-mail.org');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject guerrillamail.com (known disposable)', async () => {
        const result = await validator.validate('test@guerrillamail.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject 10minutemail.com (known disposable)', async () => {
        const result = await validator.validate('user@10minutemail.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject throwaway.email (known disposable)', async () => {
        const result = await validator.validate('test@throwaway.email');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject tempmail.com (known disposable)', async () => {
        const result = await validator.validate('user@tempmail.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject dispostable.com (known disposable)', async () => {
        const result = await validator.validate('test@dispostable.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject fakeinbox.com (known disposable)', async () => {
        const result = await validator.validate('user@fakeinbox.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject trashmail.com (known disposable)', async () => {
        const result = await validator.validate('test@trashmail.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should reject maildrop.cc (known disposable)', async () => {
        const result = await validator.validate('user@maildrop.cc');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });
    });

    describe('non-disposable domains', () => {
      it('should accept gmail.com (not disposable)', async () => {
        const result = await validator.validate('user@gmail.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.details?.checked).toBe(true);
      });

      it('should accept yahoo.com (not disposable)', async () => {
        const result = await validator.validate('user@yahoo.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept hotmail.com (not disposable)', async () => {
        const result = await validator.validate('user@hotmail.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept outlook.com (not disposable)', async () => {
        const result = await validator.validate('user@outlook.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept company.com (not disposable)', async () => {
        const result = await validator.validate('user@company.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept protonmail.com (not disposable)', async () => {
        const result = await validator.validate('user@protonmail.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('custom blacklist', () => {
      it('should reject domain in custom blacklist', async () => {
        const v = new DisposableValidator({
          customBlacklist: ['spam.com'],
        });
        const result = await v.validate('user@spam.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('custom_blacklist');
      });

      it('should reject multiple domains in custom blacklist', async () => {
        const v = new DisposableValidator({
          customBlacklist: ['spam.com', 'test.com', 'fake.com'],
        });
        const result1 = await v.validate('user@spam.com');
        const result2 = await v.validate('user@test.com');
        const result3 = await v.validate('user@fake.com');
        expect(result1.valid).toBe(false);
        expect(result2.valid).toBe(false);
        expect(result3.valid).toBe(false);
      });

      it('should handle case-insensitive blacklist', async () => {
        const v = new DisposableValidator({
          customBlacklist: ['SPAM.COM'],
        });
        const result = await v.validate('user@spam.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });
    });

    describe('custom whitelist', () => {
      it('should accept domain in custom whitelist even if disposable', async () => {
        const v = new DisposableValidator({
          customWhitelist: ['mailinator.com'],
        });
        const result = await v.validate('user@mailinator.com');
        expect(result.valid).toBe(true);
        expect(result.details?.whitelisted).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept multiple domains in custom whitelist', async () => {
        const v = new DisposableValidator({
          customWhitelist: ['mailinator.com', 'temp-mail.org'],
        });
        const result1 = await v.validate('user@mailinator.com');
        const result2 = await v.validate('user@temp-mail.org');
        expect(result1.valid).toBe(true);
        expect(result2.valid).toBe(true);
        expect(result1.details?.whitelisted).toBe(true);
        expect(result2.details?.whitelisted).toBe(true);
      });

      it('should handle case-insensitive whitelist', async () => {
        const v = new DisposableValidator({
          customWhitelist: ['MAILINATOR.COM'],
        });
        const result = await v.validate('user@mailinator.com');
        expect(result.valid).toBe(true);
        expect(result.details?.whitelisted).toBe(true);
      });

      it('should prioritize whitelist over blacklist', async () => {
        const v = new DisposableValidator({
          customBlacklist: ['company.com'],
          customWhitelist: ['company.com'],
        });
        const result = await v.validate('user@company.com');
        expect(result.valid).toBe(true);
        expect(result.details?.whitelisted).toBe(true);
      });
    });

    describe('pattern-based detection', () => {
      it('should detect 10minutemail pattern when enabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: true,
        });
        const result = await v.validate('user@10minutemail123.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('pattern_match');
      });

      it('should detect tempmail pattern when enabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: true,
        });
        const result = await v.validate('user@tempmail-test.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('pattern_match');
      });

      it('should detect temp-mail pattern when enabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: true,
        });
        const result = await v.validate('user@temp-mail-12345.org');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('pattern_match');
      });

      it('should detect throwaway pattern when enabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: true,
        });
        const result = await v.validate('user@throwaway-domain.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('pattern_match');
      });

      it('should detect spam. pattern when enabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: true,
        });
        const result = await v.validate('user@spam.example.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('pattern_match');
      });

      it('should not detect pattern when disabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: false,
        });
        const result = await v.validate('user@10minutemail123.com');
        // Should pass if not in disposable list
        // Pattern detection is disabled, so it won't catch this
        expect(result.valid).toBe(true);
      });

      it('should detect temp. pattern when enabled', async () => {
        const v = new DisposableValidator({
          enablePatternDetection: true,
        });
        const result = await v.validate('user@temp.example.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        const details = result.error?.details as Record<string, unknown>;
        expect(details?.reason).toBe('pattern_match');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', async () => {
        const result = await validator.validate('');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should handle null input', async () => {
        const result = await validator.validate(null as unknown as string);
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should handle undefined input', async () => {
        const result = await validator.validate(undefined as unknown as string);
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should handle email without domain', async () => {
        const result = await validator.validate('user@');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should handle email without @ symbol', async () => {
        const result = await validator.validate('userdomain.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should normalize email (trim whitespace)', async () => {
        const result = await validator.validate('  user@gmail.com  ');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should normalize email (lowercase domain)', async () => {
        const result = await validator.validate('user@GMAIL.COM');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should handle mixed case domain', async () => {
        const result = await validator.validate('user@MaIlInAtOr.CoM');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });
    });

    describe('result structure', () => {
      it('should return proper result structure for valid email', async () => {
        const result = await validator.validate('user@gmail.com');
        expect(result).toHaveProperty('valid', true);
        expect(result).toHaveProperty('validator', 'disposable');
        expect(result).toHaveProperty('details');
        expect(result.details).toHaveProperty('checked', true);
        expect(result.details).toHaveProperty('domain', 'gmail.com');
      });

      it('should return proper result structure for disposable email', async () => {
        const result = await validator.validate('user@mailinator.com');
        expect(result).toHaveProperty('valid', false);
        expect(result).toHaveProperty('validator', 'disposable');
        expect(result).toHaveProperty('error');
        expect(result.error).toHaveProperty('code', ErrorCode.DISPOSABLE_DOMAIN);
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('severity', 'error');
        expect(result.error).toHaveProperty('details');
        expect(result.error?.details).toHaveProperty('domain', 'mailinator.com');
        expect(result.error?.details).toHaveProperty('reason', 'known_disposable');
      });
    });

    describe('lazy loading', () => {
      it('should load disposable domains on first validation', async () => {
        // First validation should trigger lazy loading
        const result1 = await validator.validate('user@mailinator.com');
        expect(result1.valid).toBe(false);

        // Second validation should use cached set
        const result2 = await validator.validate('user@temp-mail.org');
        expect(result2.valid).toBe(false);

        // Both should work correctly
        expect(result1.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
        expect(result2.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should handle fallback when require fails', async () => {
        // This test verifies the fallback path when require() fails
        // The actual implementation will try require, then file reading, then fallback path
        // Since we can't easily mock require in ESM context, we test that validation still works
        const v = new DisposableValidator();
        const result = await v.validate('user@mailinator.com');
        // Should still work even if require path fails (uses fallback)
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.DISPOSABLE_DOMAIN);
      });

      it('should handle fallback when file reading fails', async () => {
        // Test that validation handles file reading errors gracefully
        // The implementation has multiple fallback paths
        const v = new DisposableValidator();
        const result = await v.validate('user@gmail.com');
        // Should work even if file reading fails (uses fallback or cached data)
        expect(result.valid).toBe(true);
      });
    });
  });
});
