/**
 * SMTP Validator
 *
 * Verifies mailbox existence by connecting to mail server via SMTP protocol.
 * Supports TLS/STARTTLS, greylisting detection, and configurable timeout/retries.
 */

import { BaseValidator } from './base';
import type { ValidatorResult } from '../types';
import { ValidationError, NetworkError, TimeoutError, ErrorCode } from '../errors/errors';
import * as net from 'net';
import * as tls from 'tls';

/**
 * Configuration options for SMTPValidator
 */
export interface SMTPValidatorConfig {
  enabled?: boolean;
  /**
   * Timeout for SMTP operations in milliseconds
   * @default 10000
   */
  timeout?: number;
  /**
   * Number of retry attempts for transient failures
   * @default 1
   */
  retries?: number;
  /**
   * Sender email address for MAIL FROM command
   * @default 'verify@mailtester.local'
   */
  sender?: string;
  /**
   * Require TLS/STARTTLS for connection
   * @default false
   */
  tlsRequired?: boolean;
  /**
   * Verify mailbox existence (RCPT TO command)
   * @default true
   */
  verifyMailbox?: boolean;
  /**
   * Port for SMTP connection
   * @default 25
   */
  port?: number;
}

/**
 * SMTP response structure
 */
interface SMTPResponse {
  code: number;
  message: string;
  multiline: boolean;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse SMTP response from server
 *
 * @param data - Raw response data from server
 * @returns Parsed SMTP response
 */
function parseSMTPResponse(data: string): SMTPResponse {
  const lines = data.trim().split('\r\n');
  const lastLine = lines[lines.length - 1] || '';

  // SMTP response format: CODE[-] MESSAGE
  // CODE is 3 digits, - indicates multiline response
  const match = lastLine.match(/^(\d{3})([- ])(.*)$/);
  if (!match) {
    throw new Error(`Invalid SMTP response format: ${lastLine}`);
  }

  const code = parseInt(match[1] || '0', 10);
  const isMultiline = match[2] === '-';
  const message = match[3] || '';

  return {
    code,
    message,
    multiline: isMultiline,
  };
}

/**
 * Read SMTP response from socket
 *
 * @param socket - TCP socket
 * @param timeout - Timeout in milliseconds
 * @returns Parsed SMTP response
 */
function readSMTPResponse(
  socket: net.Socket | tls.TLSSocket,
  timeout: number
): Promise<SMTPResponse> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    };

    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString();
      const response = parseSMTPResponse(buffer);

      // Check if response is complete (not multiline or last line)
      if (!response.multiline || buffer.endsWith('\r\n')) {
        cleanup();
        resolve(response);
      }
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onClose = (): void => {
      cleanup();
      reject(new Error('Connection closed before response received'));
    };

    const onTimeout = (): void => {
      cleanup();
      reject(new TimeoutError(`SMTP response timeout after ${timeout}ms`, 'smtp', timeout));
    };

    timeoutId = setTimeout(onTimeout, timeout);
    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}

/**
 * Send SMTP command and wait for response
 *
 * @param socket - TCP socket
 * @param command - SMTP command to send
 * @param timeout - Timeout in milliseconds
 * @returns Parsed SMTP response
 */
async function sendSMTPCommand(
  socket: net.Socket | tls.TLSSocket,
  command: string,
  timeout: number
): Promise<SMTPResponse> {
  return new Promise((resolve, reject) => {
    socket.write(`${command}\r\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      readSMTPResponse(socket, timeout).then(resolve).catch(reject);
    });
  });
}

/**
 * Connect to SMTP server
 *
 * @param host - SMTP server hostname
 * @param port - SMTP server port
 * @param timeout - Connection timeout in milliseconds
 * @returns Connected socket
 */
function connectToSMTP(host: string, port: number, timeout: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    const onConnect = (): void => {
      cleanup();
      socket.removeListener('error', onError);
      resolve(socket);
    };

    const onError = (error: Error): void => {
      cleanup();
      socket.destroy();
      reject(error);
    };

    const onTimeout = (): void => {
      cleanup();
      socket.destroy();
      reject(new TimeoutError(`SMTP connection timeout after ${timeout}ms`, 'smtp', timeout));
    };

    timeoutId = setTimeout(onTimeout, timeout);
    socket.once('connect', onConnect);
    socket.once('error', onError);
    socket.connect(port, host);
  });
}

/**
 * Upgrade socket to TLS using STARTTLS
 *
 * @param socket - Plain TCP socket
 * @param host - SMTP server hostname
 * @param timeout - TLS handshake timeout
 * @returns TLS socket
 */
function upgradeToTLS(socket: net.Socket, host: string, timeout: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    const tlsSocket = tls.connect(
      {
        socket,
        servername: host,
        rejectUnauthorized: false, // Allow self-signed certificates
      },
      (): void => {
        cleanup();
        resolve(tlsSocket);
      }
    );

    tlsSocket.once('error', (error: Error): void => {
      cleanup();
      reject(error);
    });

    timeoutId = setTimeout((): void => {
      cleanup();
      tlsSocket.destroy();
      reject(new TimeoutError(`TLS handshake timeout after ${timeout}ms`, 'smtp', timeout));
    }, timeout);
  });
}

/**
 * Perform SMTP mailbox verification
 *
 * @param email - Email address to verify
 * @param mxHost - MX server hostname
 * @param config - Validator configuration
 * @returns Verification result
 */
async function performSMTPVerification(
  email: string,
  mxHost: string,
  config: SMTPValidatorConfig
): Promise<{
  valid: boolean;
  mailboxExists: boolean;
  greylisted: boolean;
  details: Record<string, unknown>;
}> {
  const timeout = config.timeout ?? 10000;
  const port = config.port ?? 25;
  const sender = config.sender ?? 'verify@mailtester.local';
  const tlsRequired = config.tlsRequired ?? false;
  const verifyMailbox = config.verifyMailbox ?? true;

  let socket: net.Socket | tls.TLSSocket | null = null;
  let tlsUsed = false;

  try {
    // Step 1: Connect to SMTP server
    socket = await connectToSMTP(mxHost, port, timeout);

    // Step 2: Read initial greeting (220)
    const greeting = await readSMTPResponse(socket, timeout);
    if (greeting.code !== 220) {
      throw new ValidationError(
        `Unexpected greeting code: ${greeting.code}`,
        ErrorCode.SMTP_CONNECTION_FAILED,
        'smtp',
        { code: greeting.code, message: greeting.message }
      );
    }

    // Step 3: Send EHLO/HELO command
    const hostname = 'mailtester.local';
    const heloResponse = await sendSMTPCommand(socket, `EHLO ${hostname}`, timeout);
    if (heloResponse.code !== 250) {
      // Try HELO if EHLO fails
      const heloFallback = await sendSMTPCommand(socket, `HELO ${hostname}`, timeout);
      if (heloFallback.code !== 250) {
        throw new ValidationError(
          `HELO/EHLO failed: ${heloFallback.code}`,
          ErrorCode.SMTP_CONNECTION_FAILED,
          'smtp',
          { code: heloFallback.code, message: heloFallback.message }
        );
      }
    }

    // Step 4: Check for STARTTLS support and upgrade if needed
    const supportsSTARTTLS = heloResponse.message.toLowerCase().includes('starttls');
    if (tlsRequired && !supportsSTARTTLS) {
      throw new ValidationError(
        'TLS required but server does not support STARTTLS',
        ErrorCode.SMTP_CONNECTION_FAILED,
        'smtp',
        { mxHost }
      );
    }

    if (supportsSTARTTLS && (tlsRequired || config.tlsRequired !== false)) {
      const starttlsResponse = await sendSMTPCommand(socket, 'STARTTLS', timeout);
      if (starttlsResponse.code !== 220) {
        throw new ValidationError(
          `STARTTLS failed: ${starttlsResponse.code}`,
          ErrorCode.SMTP_CONNECTION_FAILED,
          'smtp',
          { code: starttlsResponse.code, message: starttlsResponse.message }
        );
      }
      // Upgrade to TLS
      const plainSocket = socket as net.Socket;
      socket = await upgradeToTLS(plainSocket, mxHost, timeout);
      tlsUsed = true;

      // Re-send EHLO after TLS
      const tlsHeloResponse = await sendSMTPCommand(socket, `EHLO ${hostname}`, timeout);
      if (tlsHeloResponse.code !== 250) {
        throw new ValidationError(
          `EHLO after TLS failed: ${tlsHeloResponse.code}`,
          ErrorCode.SMTP_CONNECTION_FAILED,
          'smtp',
          { code: tlsHeloResponse.code, message: tlsHeloResponse.message }
        );
      }
    }

    // Step 5: Send MAIL FROM command
    const mailFromResponse = await sendSMTPCommand(socket, `MAIL FROM:<${sender}>`, timeout);
    if (mailFromResponse.code !== 250) {
      throw new ValidationError(
        `MAIL FROM failed: ${mailFromResponse.code}`,
        ErrorCode.SMTP_CONNECTION_FAILED,
        'smtp',
        { code: mailFromResponse.code, message: mailFromResponse.message }
      );
    }

    // Step 6: Send RCPT TO command (verify mailbox)
    if (verifyMailbox) {
      const rcptToResponse = await sendSMTPCommand(socket, `RCPT TO:<${email}>`, timeout);

      // Handle different response codes
      if (rcptToResponse.code === 250 || rcptToResponse.code === 251) {
        // Mailbox exists
        return {
          valid: true,
          mailboxExists: true,
          greylisted: false,
          details: {
            mxHost,
            port,
            code: rcptToResponse.code,
            message: rcptToResponse.message,
            tlsUsed,
          },
        };
      } else if (rcptToResponse.code === 450 || rcptToResponse.code === 451) {
        // Greylisting (temporary failure)
        return {
          valid: false,
          mailboxExists: false,
          greylisted: true,
          details: {
            mxHost,
            port,
            code: rcptToResponse.code,
            message: rcptToResponse.message,
            greylisted: true,
          },
        };
      } else if (
        rcptToResponse.code === 550 ||
        rcptToResponse.code === 551 ||
        rcptToResponse.code === 553
      ) {
        // Mailbox does not exist
        return {
          valid: false,
          mailboxExists: false,
          greylisted: false,
          details: {
            mxHost,
            port,
            code: rcptToResponse.code,
            message: rcptToResponse.message,
          },
        };
      } else {
        // Other error codes
        throw new ValidationError(
          `RCPT TO failed: ${rcptToResponse.code}`,
          ErrorCode.SMTP_CONNECTION_FAILED,
          'smtp',
          { code: rcptToResponse.code, message: rcptToResponse.message }
        );
      }
    } else {
      // Mailbox verification disabled, assume valid
      return {
        valid: true,
        mailboxExists: false,
        greylisted: false,
        details: {
          mxHost,
          port,
          message: 'Mailbox verification disabled',
        },
      };
    }
  } catch (error) {
    // Clean up socket
    if (socket) {
      try {
        await sendSMTPCommand(socket, 'QUIT', timeout).catch(() => {
          // Ignore QUIT errors
        });
        socket.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }

    throw error;
  } finally {
    // Ensure socket is closed
    if (socket && !socket.destroyed) {
      socket.destroy();
    }
  }
}

/**
 * Get MX host from email domain
 * Uses MX validator's DNS lookup logic
 *
 * @param domain - Email domain
 * @returns MX hostname or null
 */
async function getMXHost(domain: string): Promise<string | null> {
  try {
    const dns = await import('dns');
    const resolver = dns.promises;

    // Try MX records first
    try {
      const mxRecords = await resolver.resolveMx(domain);
      if (mxRecords && mxRecords.length > 0) {
        // Sort by priority and return lowest priority (highest preference)
        mxRecords.sort((a, b) => a.priority - b.priority);
        return mxRecords[0]?.exchange || null;
      }
    } catch {
      // MX lookup failed, try A record
    }

    // Fallback to A record
    try {
      const aRecords = await resolver.resolve4(domain);
      if (aRecords && aRecords.length > 0) {
        return aRecords[0] || null;
      }
    } catch {
      // A record lookup also failed
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * SMTP mailbox validation validator
 *
 * Connects to mail server via SMTP to verify mailbox existence.
 * Supports TLS/STARTTLS, greylisting detection, and configurable timeout/retries.
 *
 * @example
 * ```typescript
 * const validator = new SMTPValidator({
 *   timeout: 10000,
 *   retries: 1,
 *   tlsRequired: false,
 *   verifyMailbox: true
 * });
 * const result = await validator.validate('user@example.com');
 * // result.valid = true if mailbox exists
 * // result.details.greylisted = true if greylisted
 * ```
 */
export class SMTPValidator extends BaseValidator {
  private readonly timeout: number;
  private readonly retries: number;
  private readonly sender: string;
  private readonly tlsRequired: boolean;
  private readonly verifyMailbox: boolean;
  private readonly port: number;

  constructor(config?: SMTPValidatorConfig) {
    super('smtp', { enabled: config?.enabled ?? false }); // Disabled by default (slow)

    this.timeout = config?.timeout ?? 10000;
    this.retries = config?.retries ?? 1;
    this.sender = config?.sender ?? 'verify@mailtester.local';
    this.tlsRequired = config?.tlsRequired ?? false;
    this.verifyMailbox = config?.verifyMailbox ?? true;
    this.port = config?.port ?? 25;
  }

  /**
   * Validate email mailbox via SMTP
   */
  async validate(email: string): Promise<ValidatorResult> {
    try {
      // Basic checks
      if (!email || typeof email !== 'string') {
        throw new ValidationError(
          'Email must be a non-empty string',
          ErrorCode.SMTP_CONNECTION_FAILED,
          this.name
        );
      }

      // Normalize email
      const normalized = this.normalizeEmail(email);

      // Extract domain for validation
      const domain = this.extractDomain(normalized);
      if (!domain) {
        throw new ValidationError(
          'Invalid email format: missing domain',
          ErrorCode.SMTP_CONNECTION_FAILED,
          this.name
        );
      }

      // Get MX host for domain
      const mxHost = await getMXHost(domain);
      if (!mxHost) {
        return this.createErrorResult(
          new ValidationError(
            `No MX records found for domain ${domain}`,
            ErrorCode.MX_NOT_FOUND,
            this.name,
            { domain }
          )
        );
      }

      // Perform SMTP verification with retry logic
      let lastError: Error | null = null;
      let lastResult: {
        valid: boolean;
        mailboxExists: boolean;
        greylisted: boolean;
        details: Record<string, unknown>;
      } | null = null;

      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const result = await performSMTPVerification(normalized, mxHost, {
            timeout: this.timeout,
            sender: this.sender,
            tlsRequired: this.tlsRequired,
            verifyMailbox: this.verifyMailbox,
            port: this.port,
          });

          // If greylisted, retry once more
          if (result.greylisted && attempt < this.retries) {
            await sleep(2000); // Wait 2 seconds before retry
            continue;
          }

          lastResult = result;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Don't retry on certain errors (e.g., mailbox not found)
          if (
            error instanceof ValidationError &&
            (error.code === ErrorCode.SMTP_MAILBOX_NOT_FOUND ||
              error.code === ErrorCode.MX_NOT_FOUND)
          ) {
            throw error;
          }

          // If this is not the last attempt, wait with exponential backoff
          if (attempt < this.retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
            await sleep(delay);
          }
        }
      }

      // Handle results
      if (lastResult) {
        if (lastResult.valid) {
          return this.createResult(true, {
            ...lastResult.details,
            mailboxExists: lastResult.mailboxExists,
            greylisted: lastResult.greylisted,
          });
        } else {
          // Mailbox doesn't exist or greylisted
          if (lastResult.greylisted) {
            return this.createErrorResult(
              new ValidationError(
                `Mailbox verification greylisted (temporary failure)`,
                ErrorCode.SMTP_CONNECTION_FAILED,
                this.name,
                {
                  ...lastResult.details,
                  greylisted: true,
                }
              )
            );
          } else {
            return this.createErrorResult(
              new ValidationError(
                `Mailbox does not exist`,
                ErrorCode.SMTP_MAILBOX_NOT_FOUND,
                this.name,
                lastResult.details
              )
            );
          }
        }
      }

      // All retries exhausted
      if (lastError) {
        throw lastError;
      }

      throw new ValidationError(
        'SMTP verification failed',
        ErrorCode.SMTP_CONNECTION_FAILED,
        this.name
      );
    } catch (error) {
      // Handle errors gracefully
      if (error instanceof ValidationError) {
        return this.createErrorResult(error);
      }

      // Extract domain for error details
      const domain = this.extractDomain(email);

      // Convert errors to appropriate error type
      const errorMessage = error instanceof Error ? error.message : 'SMTP verification failed';

      // Check for timeout errors
      if (errorMessage.includes('timeout') || error instanceof TimeoutError) {
        return this.createErrorResult(
          new TimeoutError(`SMTP validation timed out for ${domain}`, this.name, this.timeout, {
            domain,
            originalError: errorMessage,
          })
        );
      }

      // Check for connection errors
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        return this.createErrorResult(
          new NetworkError(`Failed to connect to SMTP server for ${domain}`, this.name, {
            domain,
            originalError: errorMessage,
          })
        );
      }

      // Other errors
      return this.createErrorResult(
        new NetworkError(`SMTP verification failed for ${domain}: ${errorMessage}`, this.name, {
          domain,
          originalError: errorMessage,
        })
      );
    }
  }
}
