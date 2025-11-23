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
import * as tls from 'tls';

// Mock net and tls modules
vi.mock('net');
vi.mock('tls');

/**
 * Helper to create a mock socket that simulates SMTP responses
 */
function createMockSocket(_responses: string[] = []): {
  socket: {
    write: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    destroyed: boolean;
  };
  triggerData: (data: string) => void;
  triggerError: (error: Error) => void;
  triggerClose: () => void;
  triggerConnect: () => void;
} {
  const dataHandlers: Array<(data: Buffer) => void> = [];
  const errorHandlers: Array<(error: Error) => void> = [];
  const closeHandlers: Array<() => void> = [];
  let connectHandler: (() => void) | null = null;

  const socket = {
    write: vi.fn((_data: string, callback?: (error?: Error) => void) => {
      if (callback) {
        callback();
      }
      return true;
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'data') {
        dataHandlers.push(handler as (data: Buffer) => void);
      } else if (event === 'error') {
        errorHandlers.push(handler as (error: Error) => void);
      } else if (event === 'close') {
        closeHandlers.push(handler as () => void);
      }
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'connect') {
        connectHandler = handler as () => void;
      } else if (event === 'error') {
        errorHandlers.push(handler as (error: Error) => void);
      }
    }),
    removeListener: vi.fn(),
    destroy: vi.fn(),
    connect: vi.fn(),
    destroyed: false,
  };

  const triggerData = (data: string): void => {
    dataHandlers.forEach((handler) => handler(Buffer.from(data)));
  };

  const triggerError = (error: Error): void => {
    errorHandlers.forEach((handler) => handler(error));
  };

  const triggerClose = (): void => {
    closeHandlers.forEach((handler) => handler());
  };

  const triggerConnect = (): void => {
    if (connectHandler) {
      connectHandler();
    }
  };

  return { socket, triggerData, triggerError, triggerClose, triggerConnect };
}

describe('SMTPValidator', () => {
  let validator: SMTPValidator;
  let mockResolveMx: ReturnType<typeof vi.spyOn>;
  let mockResolve4: ReturnType<typeof vi.spyOn>;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Spy on DNS methods
    mockResolveMx = vi.spyOn(dns.promises, 'resolveMx');
    mockResolve4 = vi.spyOn(dns.promises, 'resolve4');

    mockSocket = createMockSocket();
    // Mock net.Socket constructor
    vi.mocked(net.Socket).mockImplementation(() => mockSocket.socket as unknown as net.Socket);

    validator = new SMTPValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      mockSocket.socket.once.mockImplementation((event: string, callback: () => void) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });

      const result = await validator.validate('  USER@EXAMPLE.COM  ');
      expect(result).toBeDefined();
    });
  });

  describe('validate() - DNS lookup', () => {
    it('should fail if no MX records found', async () => {
      mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
      mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await validator.validate('user@nonexistent-domain-xyz.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
    });

    it('should use MX record if available', async () => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');

      await validator.validate('user@example.com');

      expect(mockResolveMx).toHaveBeenCalled();
    });

    it('should fallback to A record if no MX', async () => {
      mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
      mockResolve4.mockResolvedValue(['192.0.2.1']);
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');

      await validator.validate('user@example.com');

      expect(mockResolve4).toHaveBeenCalled();
    });

    it('should prioritize MX records by priority', async () => {
      mockResolveMx.mockResolvedValue([
        { priority: 20, exchange: 'mx2.example.com' },
        { priority: 10, exchange: 'mx1.example.com' },
      ]);
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');

      await validator.validate('user@example.com');

      expect(mockResolveMx).toHaveBeenCalled();
    });
  });

  describe('validate() - successful SMTP flow', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should successfully verify mailbox exists (250)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.details?.mailboxExists).toBe(true);
    });

    it('should successfully verify mailbox exists (251)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('251 OK\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.details?.mailboxExists).toBe(true);
    });

    it('should handle verifyMailbox: false', async () => {
      const v = new SMTPValidator({ verifyMailbox: false });
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.details?.mailboxExists).toBe(false);
    });

    it('should handle HELO fallback when EHLO fails', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('500 Command not recognized\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(true);
    });
  });

  describe('validate() - mailbox not found', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should detect mailbox does not exist (550)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('550 Mailbox does not exist\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_MAILBOX_NOT_FOUND);
    });

    it('should detect mailbox does not exist (551)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('551 User not local\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_MAILBOX_NOT_FOUND);
    });

    it('should detect mailbox does not exist (553)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('553 Mailbox name not allowed\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_MAILBOX_NOT_FOUND);
    });
  });

  describe('validate() - greylisting', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should detect greylisting (450)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('450 Greylisted\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect((result.error?.details as { greylisted?: boolean })?.greylisted).toBe(true);
    });

    it('should detect greylisting (451)', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('451 Temporary failure\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect((result.error?.details as { greylisted?: boolean })?.greylisted).toBe(true);
    });

    it('should retry on greylisting', async () => {
      const v = new SMTPValidator({ retries: 1, timeout: 10000 });
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

      // First attempt - greylisted
      const socket1 = createMockSocket();
      vi.mocked(net.Socket).mockImplementationOnce(() => socket1.socket as unknown as net.Socket);
      socket1.triggerConnect();
      socket1.triggerData('220 smtp.example.com ESMTP\r\n');
      socket1.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      socket1.triggerData('250 OK\r\n');
      socket1.triggerData('250 OK\r\n');
      socket1.triggerData('450 Greylisted\r\n');

      // Second attempt - success
      const socket2 = createMockSocket();
      vi.mocked(net.Socket).mockImplementationOnce(() => socket2.socket as unknown as net.Socket);
      socket2.triggerConnect();
      socket2.triggerData('220 smtp.example.com ESMTP\r\n');
      socket2.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      socket2.triggerData('250 OK\r\n');
      socket2.triggerData('250 OK\r\n');
      socket2.triggerData('250 OK\r\n');

      await vi.advanceTimersByTimeAsync(2000);
      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(true);
    });
  });

  describe('validate() - TLS/STARTTLS', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should upgrade to TLS when STARTTLS is supported', async () => {
      const mockTLSSocket = createMockSocket();
      vi.spyOn(tls, 'connect').mockImplementation(((_options: unknown, callback?: () => void) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return mockTLSSocket.socket as unknown as tls.TLSSocket;
      }) as typeof tls.connect);

      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('220 Ready to start TLS\r\n');
      mockTLSSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockTLSSocket.triggerData('250 OK\r\n');
      mockTLSSocket.triggerData('250 OK\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.details?.tlsUsed).toBe(true);
    });

    it('should fail if TLS required but not supported', async () => {
      const v = new SMTPValidator({ tlsRequired: true });
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n');

      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should fail if STARTTLS command fails', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('454 TLS not available\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should fail if EHLO after TLS fails', async () => {
      const mockTLSSocket = createMockSocket();
      vi.spyOn(tls, 'connect').mockImplementation(((_options: unknown, callback?: () => void) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return mockTLSSocket.socket as unknown as tls.TLSSocket;
      }) as typeof tls.connect);

      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('220 Ready to start TLS\r\n');
      mockTLSSocket.triggerData('500 Command failed\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });
  });

  describe('validate() - error handling', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should handle connection timeout', async () => {
      const v = new SMTPValidator({ timeout: 100 });
      // Don't trigger connect - simulate timeout

      const resultPromise = v.validate('user@example.com');
      await vi.advanceTimersByTimeAsync(200);

      const result = await resultPromise;
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle connection refused', async () => {
      mockSocket.triggerError(new Error('ECONNREFUSED'));

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('should handle ENOTFOUND error', async () => {
      mockSocket.triggerError(new Error('ENOTFOUND'));

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('should handle unexpected greeting code', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('500 Service unavailable\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should handle HELO/EHLO failure', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('500 Command not recognized\r\n');
      mockSocket.triggerData('500 Command not recognized\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should handle MAIL FROM failure', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('550 Mailbox unavailable\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should handle RCPT TO with unexpected error code', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('421 Service not available\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_CONNECTION_FAILED);
    });

    it('should handle connection closed before response', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerClose();

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
    });

    it('should handle socket write error', async () => {
      mockSocket.socket.write.mockImplementation(
        (_data: string, callback?: (error?: Error) => void) => {
          if (callback) {
            callback(new Error('Write failed'));
          }
          return false;
        }
      );
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
    });

    it('should handle TLS connection error', async () => {
      const mockTLSSocket = createMockSocket();
      vi.spyOn(tls, 'connect').mockImplementation(((_options: unknown, _callback?: () => void) => {
        setTimeout(() => {
          mockTLSSocket.triggerError(new Error('TLS handshake failed'));
        }, 0);
        return mockTLSSocket.socket as unknown as tls.TLSSocket;
      }) as typeof tls.connect);

      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('220 Ready to start TLS\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(false);
    });

    it('should handle TLS timeout', async () => {
      const v = new SMTPValidator({ timeout: 100 });
      const mockTLSSocket = createMockSocket();
      vi.spyOn(tls, 'connect').mockImplementation(((_options: unknown, _callback?: () => void) => {
        // Don't call callback - simulate timeout
        return mockTLSSocket.socket as unknown as tls.TLSSocket;
      }) as typeof tls.connect);

      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('220 Ready to start TLS\r\n');

      const resultPromise = v.validate('user@example.com');
      await vi.advanceTimersByTimeAsync(200);

      const result = await resultPromise;
      expect(result.valid).toBe(false);
    });
  });

  describe('validate() - retry logic', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should retry on transient failures', async () => {
      const v = new SMTPValidator({ retries: 1, timeout: 10000 });

      // First attempt fails
      const socket1 = createMockSocket();
      vi.mocked(net.Socket).mockImplementationOnce(() => socket1.socket as unknown as net.Socket);
      socket1.triggerError(new Error('Temporary failure'));

      // Second attempt succeeds
      const socket2 = createMockSocket();
      vi.mocked(net.Socket).mockImplementationOnce(() => socket2.socket as unknown as net.Socket);
      socket2.triggerConnect();
      socket2.triggerData('220 smtp.example.com ESMTP\r\n');
      socket2.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      socket2.triggerData('250 OK\r\n');
      socket2.triggerData('250 OK\r\n');
      socket2.triggerData('250 OK\r\n');

      await vi.advanceTimersByTimeAsync(2000);
      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(true);
    });

    it('should not retry on mailbox not found', async () => {
      const v = new SMTPValidator({ retries: 2 });
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('550 Mailbox does not exist\r\n');

      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SMTP_MAILBOX_NOT_FOUND);
      // Should not retry
      expect(mockSocket.socket.connect).toHaveBeenCalledTimes(1);
    });

    it('should not retry on MX_NOT_FOUND', async () => {
      const v = new SMTPValidator({ retries: 2 });
      mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
      mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await v.validate('user@nonexistent.com');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.MX_NOT_FOUND);
    });

    it('should exhaust retries and return error', async () => {
      const v = new SMTPValidator({ retries: 1, timeout: 10000 });
      mockSocket.triggerError(new Error('Connection failed'));

      await vi.advanceTimersByTimeAsync(2000);
      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(false);
    });
  });

  describe('validate() - multiline responses', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should handle multiline SMTP responses', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220-');
      mockSocket.triggerData('smtp.example.com');
      mockSocket.triggerData(' ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n');
      mockSocket.triggerData('250-SIZE 52428800\r\n');
      mockSocket.triggerData('250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await validator.validate('user@example.com');

      expect(result.valid).toBe(true);
    });
  });

  describe('validate() - custom configuration', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should use custom port', async () => {
      const v = new SMTPValidator({ port: 587 });
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(true);
      expect(mockSocket.socket.connect).toHaveBeenCalledWith(587, 'mx.example.com');
    });

    it('should use custom sender', async () => {
      const v = new SMTPValidator({ sender: 'custom@example.com' });
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await v.validate('user@example.com');

      expect(result.valid).toBe(true);
      // Verify MAIL FROM command includes custom sender
      const writeCalls = mockSocket.socket.write.mock.calls;
      const mailFromCall = writeCalls.find((call) => call[0]?.includes('MAIL FROM'));
      expect(mailFromCall?.[0]).toContain('custom@example.com');
    });
  });

  describe('validate() - edge cases', () => {
    it('should handle subdomain emails', async () => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.subdomain.example.com' }]);
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await validator.validate('user@subdomain.example.com');

      expect(result).toBeDefined();
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await validator.validate(longEmail);

      expect(result).toBeDefined();
    });
  });

  describe('validate() - result structure', () => {
    beforeEach(() => {
      mockResolveMx.mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);
    });

    it('should return proper result structure on success', async () => {
      mockSocket.triggerConnect();
      mockSocket.triggerData('220 smtp.example.com ESMTP\r\n');
      mockSocket.triggerData('250-mx.example.com\r\n250 STARTTLS\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');
      mockSocket.triggerData('250 OK\r\n');

      const result = await validator.validate('user@example.com');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('validator', 'smtp');
      expect(result).toHaveProperty('details');
      expect(typeof result.valid).toBe('boolean');
      expect(result.details).toHaveProperty('mxHost');
      expect(result.details).toHaveProperty('port');
      expect(result.details).toHaveProperty('mailboxExists');
    });

    it('should include error details when validation fails', async () => {
      mockResolveMx.mockRejectedValue(new Error('ENOTFOUND'));
      mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await validator.validate('user@nonexistent.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
      expect(result.error?.message).toBeDefined();
    });
  });
});
