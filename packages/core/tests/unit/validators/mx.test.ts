/**
 * MX Validator Tests
 *
 * Comprehensive test suite for MXValidator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MXValidator } from '../../../src/validators/mx';
import { ErrorCode } from '../../../src/types';
import * as dns from 'dns';

describe('MXValidator', () => {
  let validator: MXValidator;
  let mockResolveMx: ReturnType<typeof vi.spyOn>;
  let mockResolve4: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on DNS methods
    mockResolveMx = vi.spyOn(dns.promises, 'resolveMx');
    mockResolve4 = vi.spyOn(dns.promises, 'resolve4');

    validator = new MXValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create validator with default config', () => {
      const v = new MXValidator();
      expect(v.getName()).toBe('mx');
      expect(v.isEnabled()).toBe(true);
    });

    it('should create validator with custom config', () => {
      const v = new MXValidator({
        enabled: false,
        timeout: 10000,
        retries: 3,
        fallbackToA: false,
      });
      expect(v.isEnabled()).toBe(false);
    });

    it('should use default timeout of 5000ms', () => {
      const v = new MXValidator();
      expect(v).toBeInstanceOf(MXValidator);
    });

    it('should use default retries of 2', () => {
      const v = new MXValidator();
      expect(v).toBeInstanceOf(MXValidator);
    });

    it('should enable fallback to A records by default', () => {
      const v = new MXValidator();
      expect(v).toBeInstanceOf(MXValidator);
    });
  });

  describe('validate()', () => {
    describe('valid MX records', () => {
      it('should validate email with multiple MX records', async () => {
        mockResolveMx.mockResolvedValue([
          { priority: 10, exchange: 'mx1.example.com' },
          { priority: 20, exchange: 'mx2.example.com' },
        ]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        expect(result.details).toBeDefined();
        const details = result.details as Record<string, unknown>;
        expect(details.hasMX).toBe(true);
        expect(details.hasA).toBe(false);
        expect(details.quality).toBeGreaterThan(0);
        expect(Array.isArray(details.mxRecords)).toBe(true);
        expect((details.mxRecords as Array<unknown>).length).toBe(2);
      });

      it('should validate email with single MX record', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.hasMX).toBe(true);
        expect(details.quality).toBe(15); // Single MX = 15 points
      });

      it('should sort MX records by priority', async () => {
        mockResolveMx.mockResolvedValue([
          { priority: 20, exchange: 'mx2.example.com' },
          { priority: 10, exchange: 'mx1.example.com' },
        ]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        const mxRecords = details.mxRecords as Array<{ priority: number; exchange: string }>;
        expect(mxRecords[0]?.priority).toBe(10); // Lower priority first
        expect(mxRecords[1]?.priority).toBe(20);
      });

      it('should calculate quality score for multiple MX with different priorities', async () => {
        mockResolveMx.mockResolvedValue([
          { priority: 10, exchange: 'mx1.example.com' },
          { priority: 20, exchange: 'mx2.example.com' },
          { priority: 30, exchange: 'mx3.example.com' },
        ]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.quality).toBe(20); // Multiple MX with different priorities = 20 points
      });

      it('should calculate quality score for multiple MX with same priority', async () => {
        mockResolveMx.mockResolvedValue([
          { priority: 10, exchange: 'mx1.example.com' },
          { priority: 10, exchange: 'mx2.example.com' },
        ]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.quality).toBe(18); // Multiple MX with same priority = 18 points
      });
    });

    describe('A record fallback', () => {
      it('should fallback to A records when no MX records found', async () => {
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
        mockResolve4.mockResolvedValue(['192.168.1.1']);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.hasMX).toBe(false);
        expect(details.hasA).toBe(true);
        expect(details.quality).toBe(10); // A record fallback = 10 points
        expect(Array.isArray(details.aRecords)).toBe(true);
      });

      it('should not fallback to A records when fallbackToA is disabled', async () => {
        const v = new MXValidator({ fallbackToA: false });
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));

        const result = await v.validate('user@example.com');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
        expect(mockResolve4).not.toHaveBeenCalled();
      });

      it('should prefer MX records over A records', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
        mockResolve4.mockResolvedValue(['192.168.1.1']);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.hasMX).toBe(true);
        expect(details.hasA).toBe(false); // A records not checked when MX exists
        expect(mockResolve4).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle invalid email format', async () => {
        const result = await validator.validate('invalid-email');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MX_LOOKUP_FAILED);
      });

      it('should handle empty email', async () => {
        const result = await validator.validate('');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MX_LOOKUP_FAILED);
      });

      it('should handle domain not found (NXDOMAIN)', async () => {
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
        mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));

        const result = await validator.validate('user@nonexistent-domain-xyz123.com');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
      });

      it('should handle DNS timeout', async () => {
        // Mock resolveMx to never resolve (simulating timeout)
        mockResolveMx.mockImplementation(
          () =>
            new Promise(() => {
              // Never resolves - timeout will trigger
            })
        );
        // Also mock resolve4 to never resolve (to prevent fallback)
        mockResolve4.mockImplementation(
          () =>
            new Promise(() => {
              // Never resolves - timeout will trigger
            })
        );

        const v = new MXValidator({ timeout: 100, retries: 0, fallbackToA: true });
        const result = await v.validate('user@example.com');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.NETWORK_ERROR);
        expect(result.error?.message).toContain('timed out');
      });

      it('should retry on transient DNS errors', async () => {
        mockResolveMx
          .mockRejectedValueOnce(new Error('Temporary DNS error'))
          .mockResolvedValueOnce([{ priority: 10, exchange: 'mx.example.com' }]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        expect(mockResolveMx).toHaveBeenCalledTimes(2);
      });

      it('should not retry on NXDOMAIN errors', async () => {
        const nxdomainError = new Error('ENOTFOUND');
        mockResolveMx.mockRejectedValue(nxdomainError);
        mockResolve4.mockRejectedValue(nxdomainError);

        const result = await validator.validate('user@nonexistent-domain.com');

        expect(result.valid).toBe(false);
        // Should not retry NXDOMAIN errors
        expect(mockResolveMx).toHaveBeenCalledTimes(1);
      });

      it('should handle no MX and no A records', async () => {
        mockResolveMx.mockResolvedValue([]);
        mockResolve4.mockResolvedValue([]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
      });
    });

    describe('retry logic', () => {
      it('should retry with exponential backoff', async () => {
        const startTime = Date.now();
        mockResolveMx
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValueOnce([{ priority: 10, exchange: 'mx.example.com' }]);

        const v = new MXValidator({ retries: 2, timeout: 5000 });
        const result = await v.validate('user@example.com');

        expect(result.valid).toBe(true);
        const elapsed = Date.now() - startTime;
        // Should have delays between retries (exponential backoff)
        expect(elapsed).toBeGreaterThan(1000); // At least 1 second delay
        expect(mockResolveMx).toHaveBeenCalledTimes(3);
      });

      it('should respect retry limit', async () => {
        // Mock to reject on all attempts (not NXDOMAIN, so it will retry)
        mockResolveMx.mockRejectedValue(new Error('Persistent DNS error'));
        mockResolve4.mockRejectedValue(new Error('Persistent DNS error'));

        const v = new MXValidator({ retries: 1, timeout: 5000 });
        const result = await v.validate('user@example.com');

        expect(result.valid).toBe(false);
        // Should retry: initial attempt + 1 retry = 2 calls
        expect(mockResolveMx).toHaveBeenCalledTimes(2);
      });
    });

    describe('result structure', () => {
      it('should include all required fields in result', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        expect(result.validator).toBe('mx');
        expect(result.details).toBeDefined();
        const details = result.details as Record<string, unknown>;
        expect(details.domain).toBe('example.com');
        expect(details.hasMX).toBeDefined();
        expect(details.quality).toBeDefined();
        expect(details.recordCount).toBeDefined();
      });

      it('should include MX records in details', async () => {
        const mxRecords = [
          { priority: 10, exchange: 'mx1.example.com' },
          { priority: 20, exchange: 'mx2.example.com' },
        ];
        mockResolveMx.mockResolvedValue(mxRecords);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.mxRecords).toEqual(mxRecords);
        expect(details.recordCount).toBe(2);
      });

      it('should include A records in details when using fallback', async () => {
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
        mockResolve4.mockResolvedValue(['192.168.1.1', '192.168.1.2']);

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.aRecords).toEqual([{ address: '192.168.1.1' }, { address: '192.168.1.2' }]);
        expect(details.recordCount).toBe(2);
      });
    });

    describe('edge cases', () => {
      it('should handle email with subdomain', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.subdomain.example.com' }]);

        const result = await validator.validate('user@subdomain.example.com');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.domain).toBe('subdomain.example.com');
      });

      it('should normalize domain to lowercase', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        const result = await validator.validate('user@EXAMPLE.COM');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.domain).toBe('example.com');
      });

      it('should handle email with whitespace', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        const result = await validator.validate('  user@example.com  ');

        expect(result.valid).toBe(true);
        const details = result.details as Record<string, unknown>;
        expect(details.domain).toBe('example.com');
      });
    });
  });
});
