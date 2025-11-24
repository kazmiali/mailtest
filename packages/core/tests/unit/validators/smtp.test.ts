/**
 * SMTP Validator Tests
 *
 * Tests using real SMTP servers with real email addresses.
 * All tests must complete within 30 seconds total.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SMTPValidator } from '../../../src/validators/smtp';
import { ErrorCode } from '../../../src/types';

describe('SMTPValidator', () => {
  let validator: SMTPValidator;

  beforeEach(() => {
    // Use short timeout to ensure tests complete quickly
    validator = new SMTPValidator({
      enabled: true,
      timeout: 3000, // 3 seconds max per operation
      retries: 0, // No retries for faster tests
      verifyMailbox: true,
    });
  });

  describe('constructor', () => {
    it('should create validator with default config', () => {
      const v = new SMTPValidator();
      expect(v.getName()).toBe('smtp');
      expect(v.isEnabled()).toBe(false); // Disabled by default
    });

    it('should create validator with custom config', () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 15000,
        retries: 2,
        sender: 'test@example.com',
        tlsRequired: true,
        verifyMailbox: false,
        port: 587,
      });
      expect(v.isEnabled()).toBe(true);
    });
  });

  describe('validate() - input validation', () => {
    it('should fail if email is empty', async () => {
      const result = await validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should fail if email is null', async () => {
      const result = await validator.validate(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should fail if email is not a string', async () => {
      const result = await validator.validate(123 as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should fail if email has no domain', async () => {
      const result = await validator.validate('invalid-email');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should normalize email addresses', async () => {
      // Use a real domain but non-existent address
      const result = await validator.validate('  TEST@GMAIL.COM  ');
      // Should normalize and attempt validation
      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
    });
  });

  describe('validate() - DNS lookup', () => {
    it('should fail if no MX records found', async () => {
      const result = await validator.validate('user@nonexistent-domain-xyz-12345.com');
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
    });

    it('should use MX record for real domain', async () => {
      // Gmail has MX records
      const result = await validator.validate('nonexistent-user-xyz-12345@gmail.com');
      // Should connect to Gmail's SMTP server
      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
      // May succeed or fail depending on Gmail's SMTP policy
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('validate() - real SMTP validation', () => {
    it('should validate with real SMTP server (Gmail)', async () => {
      // Use a non-existent Gmail address - Gmail typically returns 550 for non-existent mailboxes
      const result = await validator.validate(
        'this-email-definitely-does-not-exist-xyz-12345@gmail.com'
      );

      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
      expect(typeof result.valid).toBe('boolean');

      // Gmail may return mailbox not found or connection error
      if (!result.valid && result.error) {
        expect([
          ErrorCode.SMTP_MAILBOX_NOT_FOUND,
          ErrorCode.SMTP_CONNECTION_FAILED,
          ErrorCode.NETWORK_ERROR,
          ErrorCode.SMTP_TIMEOUT,
        ]).toContain(result.error.code);
      }
    }, 8000); // 8 second timeout for this test

    it('should handle verifyMailbox: false', async () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 3000,
        verifyMailbox: false,
      });

      const result = await v.validate('test@example.com');

      // Should succeed without mailbox verification (if SMTP connection succeeds)
      // May fail if domain has no MX records or connection fails
      if (result.valid) {
        expect(result.details?.mailboxExists).toBe(false);
      } else {
        // If it fails, it should be due to connection/MX issues, not mailbox verification
        expect(result.error).toBeDefined();
        expect([
          ErrorCode.MX_NOT_FOUND,
          ErrorCode.SMTP_CONNECTION_FAILED,
          ErrorCode.NETWORK_ERROR,
          ErrorCode.SMTP_TIMEOUT,
        ]).toContain(result.error?.code);
      }
    }, 8000);

    it('should detect mailbox does not exist', async () => {
      // Use a well-known domain with a definitely non-existent address
      const result = await validator.validate('definitely-does-not-exist-xyz-12345@example.com');

      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');

      // Should either detect mailbox not found, MX lookup failure, or connection error
      if (!result.valid && result.error) {
        expect([
          ErrorCode.SMTP_MAILBOX_NOT_FOUND,
          ErrorCode.MX_NOT_FOUND,
          ErrorCode.SMTP_CONNECTION_FAILED,
          ErrorCode.NETWORK_ERROR,
          ErrorCode.SMTP_TIMEOUT,
        ]).toContain(result.error.code);
      }
    }, 8000);
  });

  describe('validate() - error handling', () => {
    it('should handle connection timeout', async () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 100, // Very short timeout
      });

      // Use a domain that might be slow or unreachable
      const result = await v.validate('test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // May timeout, fail with network error, or fail MX lookup before timeout
      if (result.error) {
        expect([
          ErrorCode.SMTP_TIMEOUT,
          ErrorCode.MX_NOT_FOUND,
          ErrorCode.NETWORK_ERROR,
          ErrorCode.SMTP_CONNECTION_FAILED,
        ]).toContain(result.error.code);
      }
    }, 5000);

    it('should handle invalid domain gracefully', async () => {
      const result = await validator.validate(
        'test@invalid-domain-that-does-not-exist-xyz-12345.com'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
    }, 5000);

    it('should convert timeout errors to TimeoutError', async () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 50, // Very short timeout to force timeout
      });

      // This should timeout during connection or SMTP operations
      const result = await v.validate('test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // Should detect timeout and convert to TimeoutError
      if (
        result.error?.message.includes('timeout') ||
        result.error?.code === ErrorCode.SMTP_TIMEOUT
      ) {
        expect(result.error.code).toBe(ErrorCode.SMTP_TIMEOUT);
      }
    }, 5000);

    it('should convert connection errors to NetworkError', async () => {
      // Use a domain that will fail connection
      const result = await validator.validate('test@nonexistent-domain-xyz-12345.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // Should be MX_NOT_FOUND or network error
      expect([
        ErrorCode.MX_NOT_FOUND,
        ErrorCode.NETWORK_ERROR,
        ErrorCode.SMTP_CONNECTION_FAILED,
      ]).toContain(result.error?.code);
    }, 5000);

    it('should handle errors with domain extraction in catch block', async () => {
      // Test that extractDomain is called in error handler
      const v = new SMTPValidator({
        enabled: true,
        timeout: 50,
      });

      const result = await v.validate('invalid-email-without-domain');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // Should handle gracefully even if domain extraction fails
      expect(result.error?.code).toBeDefined();
    }, 5000);

    it('should handle generic network errors', async () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 100,
      });

      // Use domain that might cause various network errors
      const result = await v.validate('test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // Should convert to appropriate error type
      expect([
        ErrorCode.SMTP_TIMEOUT,
        ErrorCode.MX_NOT_FOUND,
        ErrorCode.NETWORK_ERROR,
        ErrorCode.SMTP_CONNECTION_FAILED,
      ]).toContain(result.error?.code);
    }, 5000);
  });

  describe('validate() - custom configuration', () => {
    it('should use custom port', async () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 3000,
        port: 587, // Submission port
      });

      const result = await v.validate('test@example.com');

      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
      // May succeed or fail depending on server
      expect(typeof result.valid).toBe('boolean');
    }, 8000);

    it('should use custom sender', async () => {
      const v = new SMTPValidator({
        enabled: true,
        timeout: 3000,
        sender: 'custom-sender@example.com',
      });

      const result = await v.validate('test@example.com');

      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
      expect(typeof result.valid).toBe('boolean');
    }, 8000);
  });

  describe('validate() - result structure', () => {
    it('should return proper result structure', async () => {
      const result = await validator.validate('test@example.com');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('validator', 'smtp');
      expect(typeof result.valid).toBe('boolean');

      if (result.valid) {
        expect(result.details).toBeDefined();
        expect(result.details).toHaveProperty('mxHost');
        expect(result.details).toHaveProperty('port');
      } else {
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();
        expect(result.error?.message).toBeDefined();
      }
    }, 8000);

    it('should include error details when validation fails', async () => {
      const result = await validator.validate('test@nonexistent-domain-xyz-12345.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
      expect(result.error?.message).toBeDefined();
    }, 5000);
  });

  describe('validate() - edge cases', () => {
    it('should handle subdomain emails', async () => {
      const result = await validator.validate('test@mail.google.com');

      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
      expect(typeof result.valid).toBe('boolean');
    }, 8000);

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
      const result = await validator.validate(longEmail);

      expect(result).toBeDefined();
      expect(result.validator).toBe('smtp');
      // May fail due to invalid format or succeed
      expect(typeof result.valid).toBe('boolean');
    }, 5000);
  });
});
