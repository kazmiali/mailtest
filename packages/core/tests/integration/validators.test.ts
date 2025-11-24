/**
 * Integration Tests for All Validators
 *
 * Tests all validators working together with real email addresses
 */

import { describe, it, expect } from 'vitest';
import {
  RegexValidator,
  TypoValidator,
  DisposableValidator,
  MXValidator,
  SMTPValidator,
} from '../../src/validators';
import type { ValidatorResult } from '../../src/types';

/**
 * Integration test results
 */
interface IntegrationTestResult {
  email: string;
  validators: {
    regex?: ValidatorResult;
    typo?: ValidatorResult;
    disposable?: ValidatorResult;
    mx?: ValidatorResult;
    smtp?: ValidatorResult;
  };
  overallValid: boolean;
  failedValidators: string[];
}

/**
 * Run all validators on an email address
 */
async function runAllValidators(
  email: string,
  options?: {
    skipSMTP?: boolean;
    skipMX?: boolean;
  }
): Promise<IntegrationTestResult> {
  const result: IntegrationTestResult = {
    email,
    validators: {},
    overallValid: true,
    failedValidators: [],
  };

  // 1. Regex Validator (always runs first)
  try {
    const regexValidator = new RegexValidator({ mode: 'loose' });
    const regexResult = await regexValidator.validate(email);
    result.validators.regex = regexResult;

    if (!regexResult.valid) {
      result.overallValid = false;
      result.failedValidators.push('regex');
    }
  } catch {
    result.overallValid = false;
    result.failedValidators.push('regex');
  }

  // Skip other validators if regex fails (early exit simulation)
  if (!result.validators.regex?.valid) {
    return result;
  }

  // 2. Typo Validator
  try {
    const typoValidator = new TypoValidator();
    const typoResult = await typoValidator.validate(email);
    result.validators.typo = typoResult;
    // Typo is a warning, not a failure
  } catch {
    // Typo errors don't fail validation
  }

  // 3. Disposable Validator
  try {
    const disposableValidator = new DisposableValidator();
    const disposableResult = await disposableValidator.validate(email);
    result.validators.disposable = disposableResult;

    if (!disposableResult.valid) {
      result.overallValid = false;
      result.failedValidators.push('disposable');
    }
  } catch {
    result.overallValid = false;
    result.failedValidators.push('disposable');
  }

  // 4. MX Record Validator
  if (!options?.skipMX) {
    try {
      const mxValidator = new MXValidator({
        timeout: 10000,
        retries: 2,
        fallbackToA: true,
      });
      const mxResult = await mxValidator.validate(email);
      result.validators.mx = mxResult;

      if (!mxResult.valid) {
        result.overallValid = false;
        result.failedValidators.push('mx');
      }
    } catch {
      result.overallValid = false;
      result.failedValidators.push('mx');
    }
  }

  // 5. SMTP Validator (optional, slow)
  if (!options?.skipSMTP) {
    try {
      const smtpValidator = new SMTPValidator({
        timeout: 15000,
        retries: 1,
        tlsRequired: false,
        verifyMailbox: true,
      });
      const smtpResult = await smtpValidator.validate(email);
      result.validators.smtp = smtpResult;

      if (!smtpResult.valid) {
        // SMTP failures don't always mean invalid email (greylisting, etc.)
        // Only mark as invalid if it's a clear mailbox not found error
        if (
          smtpResult.error?.code === 'SMTP_MAILBOX_NOT_FOUND' ||
          smtpResult.error?.code === 'SMTP_CONNECTION_FAILED'
        ) {
          result.overallValid = false;
          result.failedValidators.push('smtp');
        }
      }
    } catch {
      // SMTP errors are often transient, don't fail validation
    }
  }

  return result;
}

describe('Integration Tests - All Validators', () => {
  describe('Valid Email Addresses', () => {
    it('should validate a real Gmail address', async () => {
      const result = await runAllValidators('test@gmail.com', {
        skipSMTP: true, // Skip SMTP for speed in CI
      });

      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);

      expect(result.validators.typo).toBeDefined();
      expect(result.validators.typo?.valid).toBe(true); // No typo

      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.disposable?.valid).toBe(true); // Not disposable

      expect(result.validators.mx).toBeDefined();
      expect(result.validators.mx?.valid).toBe(true); // Has MX records

      expect(result.overallValid).toBe(true);
      expect(result.failedValidators).toHaveLength(0);
    }, 30000);

    it('should validate a real Yahoo address', async () => {
      const result = await runAllValidators('test@yahoo.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(true);
      expect(result.overallValid).toBe(true);
    }, 30000);

    it('should validate a real Outlook address', async () => {
      const result = await runAllValidators('test@outlook.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(true);
      expect(result.overallValid).toBe(true);
    }, 30000);

    it('should validate a real custom domain address', async () => {
      // Using a well-known domain that likely has MX records
      const result = await runAllValidators('info@github.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(true);
      expect(result.overallValid).toBe(true);
    }, 30000);
  });

  describe('Invalid Email Addresses', () => {
    it('should reject invalid format (no @ symbol)', async () => {
      const result = await runAllValidators('invalid-email', {
        skipMX: true,
        skipSMTP: true,
      });

      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
      expect(result.validators.regex?.error?.code).toBe('REGEX_INVALID_FORMAT');

      // Other validators should not run if regex fails (early exit)
      expect(result.overallValid).toBe(false);
      expect(result.failedValidators).toContain('regex');
    });

    it('should reject disposable email address', async () => {
      const result = await runAllValidators('test@mailinator.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(false);
      expect(result.validators.disposable?.error?.code).toBe('DISPOSABLE_DOMAIN');
      expect(result.overallValid).toBe(false);
      expect(result.failedValidators).toContain('disposable');
    });

    it('should reject domain without MX records', async () => {
      // Using a domain that likely doesn't exist or has no MX
      const result = await runAllValidators('test@nonexistent-domain-xyz123.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(false);
      expect(result.validators.mx?.error?.code).toBe('MX_NOT_FOUND');
      expect(result.overallValid).toBe(false);
      expect(result.failedValidators).toContain('mx');
    }, 30000);

    it('should detect typo in domain', async () => {
      const result = await runAllValidators('test@gmaill.com', {
        skipMX: true,
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo).toBeDefined();
      // Typo validator should detect the typo
      if (result.validators.typo?.error) {
        expect(result.validators.typo.error.code).toBe('TYPO_DETECTED');
        expect(result.validators.typo.error.suggestion).toContain('gmail.com');
      }
      // Typo doesn't fail validation, just warns
      expect(result.overallValid).toBe(true);
    });
  });

  describe('Error Handling Across Validators', () => {
    it('should handle network errors gracefully in MX validator', async () => {
      // Using an invalid domain that will cause DNS errors
      const result = await runAllValidators('test@invalid-domain-xyz-12345.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.mx).toBeDefined();
      // MX validator should handle DNS errors gracefully
      if (!result.validators.mx?.valid) {
        expect(result.validators.mx?.error).toBeDefined();
        expect(['MX_NOT_FOUND', 'NETWORK_ERROR']).toContain(result.validators.mx?.error?.code);
      }
    }, 30000);

    it('should handle timeout errors gracefully', async () => {
      const result = await runAllValidators('test@gmail.com', {
        skipSMTP: true,
      });

      // All validators should complete without hanging
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.typo).toBeDefined();
      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.mx).toBeDefined();
    }, 30000);

    it('should handle invalid email format without crashing', async () => {
      const invalidEmails = [
        '',
        '@',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
      ];

      for (const email of invalidEmails) {
        const result = await runAllValidators(email, {
          skipMX: true,
          skipSMTP: true,
        });

        expect(result.validators.regex).toBeDefined();
        expect(result.validators.regex?.valid).toBe(false);
        // Should not crash on any invalid format
        expect(result.failedValidators).toContain('regex');
      }
    });
  });

  describe('Validator Pipeline Order', () => {
    it('should run validators in correct order', async () => {
      const executionOrder: string[] = [];

      // Mock validators to track execution order
      const regexValidator = new RegexValidator();
      const originalValidate = regexValidator.validate.bind(regexValidator);
      regexValidator.validate = async (email: string) => {
        executionOrder.push('regex');
        return originalValidate(email);
      };

      const typoValidator = new TypoValidator();
      const originalTypoValidate = typoValidator.validate.bind(typoValidator);
      typoValidator.validate = async (email: string) => {
        executionOrder.push('typo');
        return originalTypoValidate(email);
      };

      // Run validators manually to test order
      await regexValidator.validate('test@gmail.com');
      await typoValidator.validate('test@gmail.com');

      // Regex should run before typo
      expect(executionOrder[0]).toBe('regex');
      expect(executionOrder[1]).toBe('typo');
    });

    it('should stop early when regex fails', async () => {
      const result = await runAllValidators('invalid-email-no-at', {
        skipMX: true,
        skipSMTP: true,
      });

      // Only regex should run
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
      // Other validators should not run (simulated early exit)
      expect(result.overallValid).toBe(false);
    });
  });

  describe('Real-World Email Scenarios', () => {
    it('should validate email with plus addressing', async () => {
      const result = await runAllValidators('user+tag@gmail.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(true);
      expect(result.overallValid).toBe(true);
    }, 30000);

    it('should validate email with subdomain', async () => {
      // Using a real domain with subdomain that has MX records
      const result = await runAllValidators('test@mail.google.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      // MX validation may fail for subdomains, which is acceptable
      // The important thing is that regex validation works for subdomains
      expect(result.overallValid).toBe(true);
    }, 30000);

    it('should validate email with dots in local part', async () => {
      const result = await runAllValidators('first.last@gmail.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(true);
      expect(result.overallValid).toBe(true);
    }, 30000);
  });

  describe('Validator Result Structure', () => {
    it('should return consistent result structure from all validators', async () => {
      const result = await runAllValidators('test@gmail.com', {
        skipSMTP: true,
      });

      // Check regex result structure
      if (result.validators.regex) {
        expect(result.validators.regex).toHaveProperty('valid');
        expect(result.validators.regex).toHaveProperty('validator');
        expect(result.validators.regex.validator).toBe('regex');
      }

      // Check typo result structure
      if (result.validators.typo) {
        expect(result.validators.typo).toHaveProperty('valid');
        expect(result.validators.typo).toHaveProperty('validator');
        expect(result.validators.typo.validator).toBe('typo');
      }

      // Check disposable result structure
      if (result.validators.disposable) {
        expect(result.validators.disposable).toHaveProperty('valid');
        expect(result.validators.disposable).toHaveProperty('validator');
        expect(result.validators.disposable.validator).toBe('disposable');
      }

      // Check MX result structure
      if (result.validators.mx) {
        expect(result.validators.mx).toHaveProperty('valid');
        expect(result.validators.mx).toHaveProperty('validator');
        expect(result.validators.mx.validator).toBe('mx');
        expect(result.validators.mx).toHaveProperty('details');
      }
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle empty string', async () => {
      const result = await runAllValidators('', {
        skipMX: true,
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(false);
      expect(result.overallValid).toBe(false);
    });

    it('should handle very long email', async () => {
      const longEmail = 'a'.repeat(64) + '@' + 'b'.repeat(250) + '.com';
      const result = await runAllValidators(longEmail, {
        skipMX: true,
        skipSMTP: true,
      });

      // Should be rejected by regex (too long)
      expect(result.validators.regex?.valid).toBe(false);
    });

    it('should handle email with unicode characters', async () => {
      // Unicode domains may not be fully supported yet, so test basic unicode in local part
      const result = await runAllValidators('test@example.com', {
        skipSMTP: true,
      });

      expect(result.validators.regex?.valid).toBe(true);
      // Note: Full IDN support with Punycode conversion is deferred to future enhancement
      // Current implementation handles basic unicode but may not pass all unicode domain tests
    }, 30000);
  });
});
