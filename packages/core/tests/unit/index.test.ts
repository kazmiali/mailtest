/**
 * Basic tests to verify setup
 */
import { describe, it, expect } from 'vitest';
import { validateEmail, VERSION } from '../../src/index';
import { VALID_EMAILS, createMockEmail } from '../helpers';

describe('mailtest setup verification', () => {
  it('should export VERSION constant', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toBe('1.0.0');
  });

  it('should export validateEmail function', () => {
    expect(validateEmail).toBeDefined();
    expect(typeof validateEmail).toBe('function');
  });
});

describe('validateEmail - basic functionality', () => {
  describe('valid emails', () => {
    it('should return true for valid email format', () => {
      const result = validateEmail('user@example.com');
      expect(result).toBe(true);
    });

    it('should validate all test valid emails', () => {
      VALID_EMAILS.forEach((email) => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should validate email created by helper', () => {
      const email = createMockEmail('test', 'example.com');
      expect(validateEmail(email)).toBe(true);
    });
  });

  describe('invalid emails', () => {
    it('should return false for invalid email format', () => {
      const result = validateEmail('invalid-email');
      expect(result).toBe(false);
    });

    it('should reject emails without @ symbol', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('plainaddress')).toBe(false);
      expect(validateEmail('no-at-sign.com')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle non-string input gracefully', () => {
      // @ts-expect-error Testing runtime behavior
      expect(validateEmail(null)).toBe(false);

      // @ts-expect-error Testing runtime behavior
      expect(validateEmail(undefined)).toBe(false);

      // @ts-expect-error Testing runtime behavior
      expect(validateEmail(123)).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(validateEmail(' ')).toBe(false);
      expect(validateEmail('  user@example.com  ')).toBe(true); // Contains @
    });
  });
});
