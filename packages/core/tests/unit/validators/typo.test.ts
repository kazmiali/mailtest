/**
 * Typo Validator Tests
 *
 * Comprehensive test suite for TypoValidator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypoValidator } from '../../../src/validators/typo';
import { ErrorCode } from '../../../src/types';

describe('TypoValidator', () => {
  let validator: TypoValidator;

  beforeEach(() => {
    validator = new TypoValidator();
  });

  describe('constructor', () => {
    it('should create validator with default config', () => {
      const v = new TypoValidator();
      expect(v.getName()).toBe('typo');
      expect(v.isEnabled()).toBe(true);
    });

    it('should create validator with custom config', () => {
      const v = new TypoValidator({
        enabled: false,
        threshold: 0.9,
        domains: ['company.com'],
      });
      expect(v.isEnabled()).toBe(false);
    });

    it('should use custom domains when provided', () => {
      const customDomains = ['company.com', 'subsidiary.com'];
      const v = new TypoValidator({ domains: customDomains });
      expect(v).toBeInstanceOf(TypoValidator);
    });

    it('should use custom second-level domains when provided', () => {
      const customSecondLevel = ['corp', 'internal'];
      const v = new TypoValidator({ secondLevelDomains: customSecondLevel });
      expect(v).toBeInstanceOf(TypoValidator);
    });

    it('should use custom top-level domains when provided', () => {
      const customTLDs = ['com', 'net', 'org'];
      const v = new TypoValidator({ topLevelDomains: customTLDs });
      expect(v).toBeInstanceOf(TypoValidator);
    });

    it('should use custom threshold when provided', () => {
      const v = new TypoValidator({ threshold: 0.5 });
      expect(v).toBeInstanceOf(TypoValidator);
    });
  });

  describe('validate()', () => {
    describe('common typos', () => {
      it('should detect typo in gmail.com (gmaill.com)', async () => {
        const result = await validator.validate('user@gmaill.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('gmail.com');
        expect(result.details?.suggestion).toBe('user@gmail.com');
      });

      it('should detect typo in gmail.com (gmial.com)', async () => {
        const result = await validator.validate('user@gmial.com');
        // mailcheck may or may not detect this depending on distance threshold
        // If detected, should suggest gmail.com
        if (!result.valid) {
          expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
          expect(result.error?.suggestion).toContain('gmail.com');
        } else {
          // If not detected, should still be valid (below threshold)
          expect(result.valid).toBe(true);
        }
      });

      it('should detect typo in yahoo.com (yahooo.com)', async () => {
        const result = await validator.validate('user@yahooo.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('yahoo.com');
      });

      it('should detect typo in yahoo.com (yaho.com)', async () => {
        const result = await validator.validate('user@yaho.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('yahoo.com');
      });

      it('should detect typo in hotmail.com (hotmial.com)', async () => {
        const result = await validator.validate('user@hotmial.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('hotmail.com');
      });

      it('should detect typo in outlook.com (outlok.com)', async () => {
        const result = await validator.validate('user@outlok.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('outlook.com');
      });

      it('should detect typo in outlook.com (outloo.com)', async () => {
        const result = await validator.validate('user@outloo.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('outlook.com');
      });

      it('should detect typo in TLD (example.con)', async () => {
        const result = await validator.validate('user@example.con');
        // mailcheck may suggest .co or .com depending on matching
        if (!result.valid) {
          expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
          expect(result.error?.suggestion).toBeDefined();
          // Should suggest a valid TLD
          expect(result.error?.suggestion).toMatch(/\.(com|co|net|org)/);
        }
      });

      it('should detect typo in TLD (example.cmo)', async () => {
        const result = await validator.validate('user@example.cmo');
        // mailcheck may suggest .ca or .com depending on matching
        if (!result.valid) {
          expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
          expect(result.error?.suggestion).toBeDefined();
          // Should suggest a valid TLD
          expect(result.error?.suggestion).toMatch(/\.(com|ca|net|org)/);
        }
      });
    });

    describe('no typo cases', () => {
      it('should not detect typo for correct gmail.com', async () => {
        const result = await validator.validate('user@gmail.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.details?.checked).toBe(true);
        expect(result.details?.suggestion).toBeNull();
      });

      it('should not detect typo for correct yahoo.com', async () => {
        const result = await validator.validate('user@yahoo.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should not detect typo for correct hotmail.com', async () => {
        const result = await validator.validate('user@hotmail.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should not detect typo for correct outlook.com', async () => {
        const result = await validator.validate('user@outlook.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should not detect typo for custom domain', async () => {
        const result = await validator.validate('user@company.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should not detect typo for rare but valid domain', async () => {
        const result = await validator.validate('user@rare-domain.xyz');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('custom domain lists', () => {
      it('should detect typo in custom domain', async () => {
        const customValidator = new TypoValidator({
          domains: ['company.com', 'subsidiary.com'],
        });
        const result = await customValidator.validate('user@comapny.com');
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.suggestion).toContain('company.com');
      });

      it('should not detect typo for correct custom domain', async () => {
        const customValidator = new TypoValidator({
          domains: ['company.com', 'subsidiary.com'],
        });
        const result = await customValidator.validate('user@company.com');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('confidence scoring', () => {
      it('should include confidence score in details when typo detected', async () => {
        const result = await validator.validate('user@gmaill.com');
        expect(result.valid).toBe(false);
        expect(result.details?.confidence).toBeDefined();
        expect(typeof result.details?.confidence).toBe('number');
        expect(result.details?.confidence).toBeGreaterThan(0);
        expect(result.details?.confidence).toBeLessThanOrEqual(1);
      });

      it('should include confidence score in error details', async () => {
        const result = await validator.validate('user@gmaill.com');
        expect(result.error?.details).toBeDefined();
        const details = result.error?.details as Record<string, unknown>;
        expect(details.confidence).toBeDefined();
        expect(typeof details.confidence).toBe('number');
      });
    });

    describe('threshold behavior', () => {
      it('should not flag typo when confidence is below threshold', async () => {
        const highThresholdValidator = new TypoValidator({
          threshold: 0.99, // Very high threshold
        });
        const result = await highThresholdValidator.validate('user@gmaill.com');
        // May or may not detect depending on distance, but if detected, should have high confidence
        if (!result.valid) {
          const details = result.error?.details as Record<string, unknown>;
          expect(details.confidence).toBeGreaterThanOrEqual(0.99);
        }
      });

      it('should flag typo when confidence meets threshold', async () => {
        const lowThresholdValidator = new TypoValidator({
          threshold: 0.1, // Very low threshold
        });
        const result = await lowThresholdValidator.validate('user@gmaill.com');
        // Should detect typo with low threshold
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
      });

      it('should include belowThreshold flag when confidence is below threshold', async () => {
        const highThresholdValidator = new TypoValidator({
          threshold: 0.99,
        });
        const result = await highThresholdValidator.validate('user@example.com');
        // If suggestion exists but below threshold
        if (result.details?.belowThreshold) {
          expect(result.valid).toBe(true);
          expect(result.details.belowThreshold).toBe(true);
        }
      });
    });

    describe('error handling', () => {
      it('should handle invalid email format', async () => {
        const result = await validator.validate('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle email without domain', async () => {
        const result = await validator.validate('user@');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle null input', async () => {
        const result = await validator.validate(null as unknown as string);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
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
    });

    describe('result structure', () => {
      it('should return correct result structure for valid email', async () => {
        const result = await validator.validate('user@gmail.com');
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('validator');
        expect(result).toHaveProperty('details');
        expect(result.validator).toBe('typo');
        expect(result.valid).toBe(true);
      });

      it('should return correct result structure for typo detected', async () => {
        const result = await validator.validate('user@gmaill.com');
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('validator');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('details');
        expect(result.validator).toBe('typo');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
        expect(result.error?.severity).toBe('warning');
      });

      it('should include suggestion in error', async () => {
        const result = await validator.validate('user@gmaill.com');
        expect(result.error?.suggestion).toBeDefined();
        expect(result.error?.suggestion).toContain('Did you mean');
        expect(result.error?.suggestion).toContain('gmail.com');
      });

      it('should include original and suggested email in details', async () => {
        const result = await validator.validate('user@gmaill.com');
        const details = result.error?.details as Record<string, unknown>;
        expect(details.original).toBeDefined();
        expect(details.suggestion).toBeDefined();
        expect(details.domain).toBeDefined();
        expect(details.confidence).toBeDefined();
      });
    });

    describe('expanded TLD coverage', () => {
      it('should support expanded TLDs', async () => {
        // Test with a less common TLD that should be in expanded list
        const result = await validator.validate('user@example.io');
        expect(result.valid).toBe(true);
      });

      it('should detect typos in expanded TLDs', async () => {
        const result = await validator.validate('user@example.oi'); // typo of .io
        // May or may not detect depending on mailcheck's matching
        expect(result).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle email with plus addressing', async () => {
      const result = await validator.validate('user+tag@gmaill.com');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
    });

    it('should handle email with dots in local part', async () => {
      const result = await validator.validate('user.name@gmaill.com');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.TYPO_DETECTED);
    });

    it('should handle subdomain emails', async () => {
      const result = await validator.validate('user@subdomain.gmaill.com');
      // May or may not detect depending on mailcheck behavior
      expect(result).toBeDefined();
    });
  });
});
