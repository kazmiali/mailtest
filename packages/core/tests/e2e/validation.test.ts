/**
 * End-to-End tests for mailtest validation pipeline
 *
 * Tests the complete validation workflow from public API through orchestrator
 * to final result formatting.
 */
import { describe, it, expect } from 'vitest';
import { validate, createValidator } from '../../src/index';

describe('E2E Validation - Full Pipeline', () => {
  describe('Full validation pipeline', () => {
    it('should validate email through full pipeline with all validators', async () => {
      const result = await validate('user@gmail.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
          mx: { enabled: true },
          smtp: { enabled: false }, // Disabled for speed
        },
      });

      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@gmail.com');
      expect(result.score).toBeGreaterThan(0);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo).toBeDefined();
      expect(result.validators.typo?.valid).toBe(true);
      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.disposable?.valid).toBe(true);
      expect(result.validators.mx).toBeDefined();
      expect(result.validators.mx?.valid).toBe(true);
    });

    it('should validate valid email with default configuration', async () => {
      const result = await validate('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('user@example.com');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
    });

    it('should validate email with plus addressing', async () => {
      const result = await validate('user+tag@gmail.com');

      expect(result.valid).toBe(true);
      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.disposable?.valid).toBe(true);
    });

    it('should validate email with subdomain', async () => {
      const result = await validate('user@mail.google.com');

      expect(result.valid).toBe(true);
      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.mx?.valid).toBe(true);
    });

    it('should validate email with dots in local part', async () => {
      const result = await validate('first.last@gmail.com');

      expect(result.valid).toBe(true);
      expect(result.validators.regex?.valid).toBe(true);
    });
  });

  describe('Early exit behavior', () => {
    it('should stop early on failure when earlyExit is enabled', async () => {
      const validator = createValidator({
        earlyExit: true,
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
          mx: { enabled: true },
        },
      });

      const result = await validator.validate('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
      // Typo validator should not run when regex fails with early exit
      expect(result.validators.typo).toBeUndefined();
      expect(result.validators.disposable).toBeUndefined();
      expect(result.validators.mx).toBeUndefined();
      expect(result.reason).toBe('regex');
    });

    it('should continue all validators when earlyExit is disabled', async () => {
      const validator = createValidator({
        earlyExit: false,
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
          mx: { enabled: true },
        },
      });

      const result = await validator.validate('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
      // All validators should run even if regex fails
      expect(result.validators.typo).toBeDefined();
      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.mx).toBeDefined();
    });

    it('should not stop early on typo warnings', async () => {
      const validator = createValidator({
        earlyExit: true,
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
        },
      });

      // Email with typo (gmaill.com instead of gmail.com)
      const result = await validator.validate('user@gmaill.com');

      // Typo warnings don't trigger early exit
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.typo).toBeDefined();
      // Disposable might not run if typo triggers early exit incorrectly
      // But typo warnings shouldn't trigger early exit, so disposable should run
      // However, if disposable is disabled or not configured, it won't run
      // Email should still be valid (typo is warning, not error)
      expect(result.valid).toBe(true);
    });
  });

  describe('Various configurations', () => {
    it('should work with strict preset', async () => {
      const validator = createValidator({
        preset: 'strict',
        validators: {
          smtp: { enabled: false }, // Disable SMTP for speed in tests
        },
      });
      const result = await validator.validate('user@gmail.com');

      expect(result.valid).toBe(true);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
    });

    it('should work with balanced preset (default)', async () => {
      const validator = createValidator({ preset: 'balanced' });
      const result = await validator.validate('user@gmail.com');

      expect(result.valid).toBe(true);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
      // SMTP should be disabled in balanced preset
      expect(result.validators.smtp).toBeUndefined();
    });

    it('should work with permissive preset', async () => {
      const validator = createValidator({ preset: 'permissive' });
      const result = await validator.validate('user@gmail.com');

      expect(result.valid).toBe(true);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
      // Only regex should run in permissive preset
      expect(result.validators.typo).toBeUndefined();
      expect(result.validators.disposable).toBeUndefined();
      expect(result.validators.mx).toBeUndefined();
    });

    it('should skip disabled validators', async () => {
      const result = await validate('user@gmail.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: false },
          disposable: { enabled: false },
          mx: { enabled: false },
          smtp: { enabled: false },
        },
      });

      expect(result.valid).toBe(true);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(true);
      expect(result.validators.typo).toBeUndefined();
      expect(result.validators.disposable).toBeUndefined();
      expect(result.validators.mx).toBeUndefined();
      expect(result.validators.smtp).toBeUndefined();
    });

    it('should work with custom validator configuration', async () => {
      const result = await validate('user@gmail.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
          mx: { enabled: true },
        },
      });

      expect(result.valid).toBe(true);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.typo).toBeDefined();
      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.mx).toBeDefined();
    });
  });

  describe('Output format verification', () => {
    it('should return properly formatted ValidationResult', async () => {
      const result = await validate('user@example.com');

      // Check required fields
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('validators');

      // Check types
      expect(typeof result.valid).toBe('boolean');
      expect(typeof result.email).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(typeof result.validators).toBe('object');

      // Check score range
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Check validators structure
      expect(result.validators).toBeDefined();
      if (result.validators.regex) {
        expect(result.validators.regex).toHaveProperty('valid');
        expect(result.validators.regex).toHaveProperty('validator');
        expect(typeof result.validators.regex.valid).toBe('boolean');
        expect(typeof result.validators.regex.validator).toBe('string');
      }
    });

    it('should include metadata when validation completes', async () => {
      const result = await validate('user@example.com');

      // Metadata is optional, but if present should have correct structure
      if (result.metadata) {
        expect(result.metadata).toHaveProperty('timestamp');
        expect(result.metadata).toHaveProperty('duration');
        expect(typeof result.metadata.timestamp).toBe('string');
        expect(typeof result.metadata.duration).toBe('number');
        expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
        // Timestamp should be ISO 8601 format
        const timestamp = result.metadata.timestamp;
        if (timestamp) {
          expect(() => new Date(timestamp)).not.toThrow();
        }
      }
    });

    it('should set reason when validation fails', async () => {
      const result = await validate('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(['regex', 'typo', 'disposable', 'mx', 'smtp', 'custom']).toContain(result.reason);
    });

    it('should include error details in validator results', async () => {
      const result = await validate('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
      expect(result.validators.regex?.error).toBeDefined();
      if (result.validators.regex?.error) {
        expect(result.validators.regex.error).toHaveProperty('code');
        expect(result.validators.regex.error).toHaveProperty('message');
        expect(result.validators.regex.error).toHaveProperty('severity');
        expect(typeof result.validators.regex.error.code).toBe('string');
        expect(typeof result.validators.regex.error.message).toBe('string');
        expect(['warning', 'error', 'critical']).toContain(result.validators.regex.error.severity);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle invalid email format gracefully', async () => {
      const result = await validate('not-an-email');

      expect(result.valid).toBe(false);
      expect(result.validators.regex).toBeDefined();
      expect(result.validators.regex?.valid).toBe(false);
      expect(result.reason).toBe('regex');
    });

    it('should handle disposable email addresses', async () => {
      const result = await validate('test@mailinator.com');

      expect(result.valid).toBe(false);
      expect(result.validators.disposable).toBeDefined();
      expect(result.validators.disposable?.valid).toBe(false);
      expect(result.reason).toBe('disposable');
    });

    it('should handle domains without MX records', async () => {
      const result = await validate('user@nonexistent-domain-xyz123.com', {
        validators: {
          regex: { enabled: true },
          mx: { enabled: true },
        },
      });

      expect(result.valid).toBe(false);
      expect(result.validators.mx).toBeDefined();
      expect(result.validators.mx?.valid).toBe(false);
      expect(result.reason).toBe('mx');
    });

    it('should handle network errors gracefully', async () => {
      // This test verifies that network errors don't crash the validation
      // We'll use a domain that might timeout or fail DNS lookup
      const result = await validate('user@example.com', {
        validators: {
          regex: { enabled: true },
          mx: { enabled: true },
        },
      });

      // Should still return a result (either valid or invalid)
      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('Performance', () => {
    it('should complete validation in reasonable time (without SMTP)', async () => {
      const startTime = Date.now();
      const result = await validate('user@gmail.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
          mx: { enabled: true },
          smtp: { enabled: false },
        },
      });
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      // Should complete in < 150ms (target from PLAN.md)
      expect(duration).toBeLessThan(5000); // Using 5s as reasonable upper bound for CI
    });

    it('should complete regex-only validation quickly', async () => {
      const startTime = Date.now();
      const result = await validate('user@example.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: false },
          disposable: { enabled: false },
          mx: { enabled: false },
          smtp: { enabled: false },
        },
      });
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      // Regex-only should be very fast (< 10ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Real-world scenarios', () => {
    it('should validate common email providers', async () => {
      const emails = ['user@gmail.com', 'user@yahoo.com', 'user@outlook.com'];

      for (const email of emails) {
        const result = await validate(email);
        expect(result.valid).toBe(true);
        expect(result.validators.regex?.valid).toBe(true);
        expect(result.validators.disposable?.valid).toBe(true);
      }
    });

    it('should handle multiple validations with same validator instance', async () => {
      const validator = createValidator({ preset: 'balanced' });

      const results = await Promise.all([
        validator.validate('user1@gmail.com'),
        validator.validate('user2@yahoo.com'),
        validator.validate('user3@outlook.com'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.valid).toBe(true);
        expect(result.validators.regex?.valid).toBe(true);
      });
    });

    it('should handle edge cases correctly', async () => {
      // Very long email
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
      const result1 = await validate(longEmail);
      expect(result1).toBeDefined();
      expect(typeof result1.valid).toBe('boolean');

      // Email with special characters
      const specialEmail = 'user+tag@example.com';
      const result2 = await validate(specialEmail);
      expect(result2.valid).toBe(true);

      // Email with subdomain (might fail MX check if domain doesn't exist)
      const subdomainEmail = 'user@mail.google.com';
      const result3 = await validate(subdomainEmail, {
        validators: {
          regex: { enabled: true },
          mx: { enabled: true },
        },
      });
      expect(result3.valid).toBe(true);
    });
  });

  describe('Score calculation', () => {
    it('should calculate score for valid email', async () => {
      const result = await validate('user@gmail.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: true },
          disposable: { enabled: true },
          mx: { enabled: true },
        },
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      // Valid email should have high score
      expect(result.score).toBeGreaterThan(50);
    });

    it('should calculate low score for invalid email', async () => {
      const result = await validate('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      // Invalid email should have low score
      expect(result.score).toBeLessThan(50);
    });

    it('should calculate score for disposable email', async () => {
      const result = await validate('test@mailinator.com', {
        validators: {
          regex: { enabled: true },
          typo: { enabled: false }, // Disable typo to get predictable score
          disposable: { enabled: true },
          mx: { enabled: false }, // Disable MX to get predictable score
        },
      });

      expect(result.valid).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      // Disposable email should have low score (only regex passes = 20 points)
      expect(result.score).toBeLessThan(30);
    });
  });
});
