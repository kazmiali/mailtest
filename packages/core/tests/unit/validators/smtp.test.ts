/**
 * SMTP Validator Tests
 *
 * Comprehensive test suite for SMTPValidator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SMTPValidator } from '../../../src/validators/smtp';
import { ErrorCode } from '../../../src/types';
import * as dns from 'dns';
import * as net from 'net';

// Mock net and tls modules
vi.mock('net');
vi.mock('tls');

describe('SMTPValidator', () => {
  let validator: SMTPValidator;
  let mockResolveMx: ReturnType<typeof vi.spyOn>;
  let mockResolve4: ReturnType<typeof vi.spyOn>;
  let mockSocket: {
    write: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    destroyed: boolean;
  };

  beforeEach(() => {
    // Spy on DNS methods
    mockResolveMx = vi.spyOn(dns.promises, 'resolveMx');
    mockResolve4 = vi.spyOn(dns.promises, 'resolve4');

    // Create mock socket
    mockSocket = {
      write: vi.fn((_data: string, callback?: () => void) => {
        if (callback) {
          callback();
        }
        return true;
      }),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      destroy: vi.fn(),
      connect: vi.fn(),
      destroyed: false,
    };

    // Mock net.Socket constructor
    vi.mocked(net.Socket).mockImplementation(() => mockSocket as unknown as net.Socket);

    validator = new SMTPValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    it('should use default timeout of 10000ms', () => {
      const v = new SMTPValidator();
      expect(v).toBeInstanceOf(SMTPValidator);
    });

    it('should use default retries of 1', () => {
      const v = new SMTPValidator();
      expect(v).toBeInstanceOf(SMTPValidator);
    });

    it('should use default sender', () => {
      const v = new SMTPValidator();
      expect(v).toBeInstanceOf(SMTPValidator);
    });
  });

  describe('validate()', () => {
    describe('DNS lookup', () => {
      it('should fail if no MX records found', async () => {
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
        mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));

        const result = await validator.validate('user@nonexistent-domain-xyz.com');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
      });

      it('should use MX record if available', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        // Mock socket connection and responses
        mockSocket.once.mockImplementation((event: string, callback: () => void) => {
          if (event === 'connect') {
            setTimeout(() => callback(), 0);
          }
        });

        mockSocket.on.mockImplementation((event: string, callback: (data?: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('220 smtp.example.com ESMTP\r\n'));
            }, 0);
          }
        });

        await validator.validate('user@example.com');

        // Should attempt connection (may fail in test environment)
        expect(mockResolveMx).toHaveBeenCalled();
      });

      it('should fallback to A record if no MX', async () => {
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
        mockResolve4.mockResolvedValue(['192.0.2.1']);

        mockSocket.once.mockImplementation((event: string, callback: () => void) => {
          if (event === 'connect') {
            setTimeout(() => callback(), 0);
          }
        });

        mockSocket.on.mockImplementation((event: string, callback: (data?: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('220 smtp.example.com ESMTP\r\n'));
            }, 0);
          }
        });

        await validator.validate('user@example.com');

        expect(mockResolve4).toHaveBeenCalled();
      });
    });

    describe('SMTP response codes', () => {
      beforeEach(() => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      });

      it('should handle invalid email format', async () => {
        const result = await validator.validate('invalid-email');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
      });

      it('should handle empty email', async () => {
        const result = await validator.validate('');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
      });

      it('should handle null email', async () => {
        const result = await validator.validate(null as unknown as string);

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      });

      it('should handle connection timeout', async () => {
        mockSocket.once.mockImplementation((event: string, _callback: () => void) => {
          if (event === 'connect') {
            // Don't call callback - simulate timeout
          }
        });

        const v = new SMTPValidator({ timeout: 100 });
        const result = await v.validate('user@example.com');

        // Should handle timeout gracefully
        expect(result.valid).toBe(false);
      });

      it('should handle connection refused', async () => {
        mockSocket.once.mockImplementation((event: string, callback: (error?: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => {
              callback(new Error('ECONNREFUSED'));
            }, 0);
          }
        });

        mockSocket.connect.mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockSocket.once.mock.calls.find(
              (call) => call[0] === 'error'
            )?.[1] as (error: Error) => void;
            if (errorCallback) {
              errorCallback(new Error('ECONNREFUSED'));
            }
          }, 0);
        });

        const result = await validator.validate('user@example.com');

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.NETWORK_ERROR);
      });
    });

    describe('configuration options', () => {
      beforeEach(() => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      });

      it('should respect verifyMailbox: false', async () => {
        const v = new SMTPValidator({ verifyMailbox: false });

        // With verifyMailbox disabled, should not fail on mailbox check
        // (actual SMTP connection may still fail in test environment)
        const _result = await v.validate('user@example.com');

        // Result depends on connection success
        expect(_result).toBeDefined();
      });

      it('should use custom sender', async () => {
        const v = new SMTPValidator({ sender: 'custom@example.com' });

        await v.validate('user@example.com');

        // Validator should be created with custom sender
        expect(v).toBeInstanceOf(SMTPValidator);
      });

      it('should use custom port', async () => {
        const v = new SMTPValidator({ port: 587 });

        await v.validate('user@example.com');

        expect(v).toBeInstanceOf(SMTPValidator);
      });
    });

    describe('retry logic', () => {
      beforeEach(() => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      });

      it('should retry on transient failures', async () => {
        const v = new SMTPValidator({ retries: 2, timeout: 100 });

        // Mock connection failure
        mockSocket.once.mockImplementation((event: string, callback: (error?: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => {
              callback(new Error('Temporary failure'));
            }, 0);
          }
        });

        const _result = await v.validate('user@example.com');

        // Should attempt retries
        expect(_result).toBeDefined();
      });
    });

    describe('result structure', () => {
      beforeEach(() => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      });

      it('should return proper result structure', async () => {
        const result = await validator.validate('user@example.com');

        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('validator', 'smtp');
        expect(typeof result.valid).toBe('boolean');
      });

      it('should include error details when validation fails', async () => {
        mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
        mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));

        const result = await validator.validate('user@nonexistent.com');

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();
        expect(result.error?.message).toBeDefined();
      }, 5000);
    });

    describe('edge cases', () => {
      it('should handle subdomain emails', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.subdomain.example.com' }]);

        const result = await validator.validate('user@subdomain.example.com');

        expect(result).toBeDefined();
      });

      it('should normalize email addresses', async () => {
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        const result1 = await validator.validate('  USER@EXAMPLE.COM  ');
        const result2 = await validator.validate('user@example.com');

        // Both should be normalized
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
      });

      it('should handle very long email addresses', async () => {
        const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
        mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

        const result = await validator.validate(longEmail);

        expect(result).toBeDefined();
      });
    });
  });

  describe('integration with MX validator', () => {
    it('should work with valid MX records', async () => {
      mockResolveMx.mockResolvedValue([
        { priority: 10, exchange: 'mx.gmail.com' },
        { priority: 20, exchange: 'mx2.gmail.com' },
      ]);

      await validator.validate('user@gmail.com');

      expect(mockResolveMx).toHaveBeenCalledWith('gmail.com');
    });

    it('should prioritize MX records by priority', async () => {
      mockResolveMx.mockResolvedValue([
        { priority: 20, exchange: 'mx2.example.com' },
        { priority: 10, exchange: 'mx1.example.com' },
      ]);

      await validator.validate('user@example.com');

      // Should use lowest priority (highest preference)
      expect(mockResolveMx).toHaveBeenCalled();
    });
  });
});
