/**
 * MX Record Validator
 *
 * Verifies domain has valid mail exchange servers via DNS lookup.
 * Supports retry logic, MX quality scoring, and fallback to A records.
 */

import { BaseValidator } from './base';
import type { ValidatorResult } from '../types';
import { ValidationError, NetworkError, ErrorCode } from '../errors/errors';
import * as dns from 'dns';

/**
 * Configuration options for MXValidator
 */
export interface MXValidatorConfig {
  enabled?: boolean;
  /**
   * Timeout for DNS lookup in milliseconds
   * @default 5000
   */
  timeout?: number;
  /**
   * Number of retry attempts for DNS lookup
   * @default 2
   */
  retries?: number;
  /**
   * Custom DNS servers to use (not implemented in v1.0, uses system DNS)
   * @default []
   */
  dnsServers?: string[];
  /**
   * Fallback to A record if no MX records found
   * @default true
   */
  fallbackToA?: boolean;
}

/**
 * MX record structure
 */
interface MXRecord {
  priority: number;
  exchange: string;
}

/**
 * A record structure
 */
interface ARecord {
  address: string;
}

/**
 * DNS lookup result
 */
interface DNSResult {
  mxRecords: MXRecord[];
  aRecords: ARecord[];
  hasMX: boolean;
  hasA: boolean;
  quality: number; // 0-100 quality score
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve MX records with retry logic and exponential backoff
 *
 * @param domain - Domain to lookup
 * @param retries - Number of retry attempts
 * @param timeout - Timeout in milliseconds
 * @returns MX records array
 */
async function resolveMXWithRetry(
  domain: string,
  retries: number = 2,
  timeout: number = 5000
): Promise<MXRecord[]> {
  const resolver = dns.promises;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create a promise that rejects on timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('DNS lookup timeout')), timeout);
      });

      // Race between DNS lookup and timeout
      const mxRecords = await Promise.race([resolver.resolveMx(domain), timeoutPromise]);

      // Sort by priority (lower priority = higher preference)
      return mxRecords
        .map((record) => ({
          priority: record.priority,
          exchange: record.exchange,
        }))
        .sort((a, b) => a.priority - b.priority);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors (e.g., NXDOMAIN)
      if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('NXDOMAIN')) {
        throw lastError;
      }

      // If this is not the last attempt, wait with exponential backoff
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('DNS lookup failed after retries');
}

/**
 * Resolve A records with retry logic
 *
 * @param domain - Domain to lookup
 * @param retries - Number of retry attempts
 * @param timeout - Timeout in milliseconds
 * @returns A records array
 */
async function resolveAWithRetry(
  domain: string,
  retries: number = 2,
  timeout: number = 5000
): Promise<ARecord[]> {
  const resolver = dns.promises;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create a promise that rejects on timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('DNS lookup timeout')), timeout);
      });

      // Race between DNS lookup and timeout
      const addresses = await Promise.race([resolver.resolve4(domain), timeoutPromise]);

      return addresses.map((address) => ({ address }));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors (e.g., NXDOMAIN)
      if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('NXDOMAIN')) {
        throw lastError;
      }

      // If this is not the last attempt, wait with exponential backoff
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('DNS lookup failed after retries');
}

/**
 * Calculate MX record quality score (0-100)
 *
 * Scoring factors:
 * - Multiple MX records with proper priority: 20 points
 * - Single MX record: 15 points
 * - A record fallback: 10 points
 * - No records: 0 points
 *
 * @param mxRecords - MX records array
 * @param hasA - Whether A records exist
 * @returns Quality score (0-100)
 */
function calculateMXQuality(mxRecords: MXRecord[], hasA: boolean): number {
  if (mxRecords.length === 0) {
    return hasA ? 10 : 0; // A record fallback gets 10 points
  }

  if (mxRecords.length === 1) {
    return 15; // Single MX record
  }

  // Multiple MX records with proper priority distribution
  // Check if priorities are well-distributed (not all same priority)
  const priorities = mxRecords.map((r) => r.priority);
  const uniquePriorities = new Set(priorities).size;

  if (uniquePriorities > 1) {
    return 20; // Multiple MX with different priorities (best)
  }

  return 18; // Multiple MX with same priority (still good)
}

/**
 * Perform DNS lookup for MX and A records
 *
 * @param domain - Domain to lookup
 * @param config - Validator configuration
 * @returns DNS lookup result
 */
async function performDNSLookup(domain: string, config: MXValidatorConfig): Promise<DNSResult> {
  const timeout = config.timeout ?? 5000;
  const retries = config.retries ?? 2;
  const fallbackToA = config.fallbackToA ?? true;

  let mxRecords: MXRecord[] = [];
  let aRecords: ARecord[] = [];
  let hasMX = false;
  let hasA = false;

  // Try MX lookup first
  try {
    mxRecords = await resolveMXWithRetry(domain, retries, timeout);
    hasMX = mxRecords.length > 0;
  } catch (error) {
    // MX lookup failed, will try A record fallback if enabled
    if (!fallbackToA) {
      throw error;
    }
  }

  // Fallback to A record if no MX records found
  if (!hasMX && fallbackToA) {
    try {
      aRecords = await resolveAWithRetry(domain, retries, timeout);
      hasA = aRecords.length > 0;
    } catch (error) {
      // A record lookup also failed
      if (!hasMX) {
        throw error;
      }
    }
  }

  // Calculate quality score
  const quality = calculateMXQuality(mxRecords, hasA);

  return {
    mxRecords,
    aRecords,
    hasMX,
    hasA,
    quality,
  };
}

/**
 * MX record validation validator
 *
 * Checks if a domain has valid mail exchange (MX) records.
 * Supports retry logic, quality scoring, and A record fallback.
 *
 * @example
 * ```typescript
 * const validator = new MXValidator({
 *   timeout: 5000,
 *   retries: 2,
 *   fallbackToA: true
 * });
 * const result = await validator.validate('user@example.com');
 * // result.valid = true if MX or A records found
 * // result.details.quality = 0-100 quality score
 * ```
 */
export class MXValidator extends BaseValidator {
  private readonly timeout: number;
  private readonly retries: number;
  private readonly fallbackToA: boolean;

  constructor(config?: MXValidatorConfig) {
    super('mx', { enabled: config?.enabled ?? true });

    this.timeout = config?.timeout ?? 5000;
    this.retries = config?.retries ?? 2;
    this.fallbackToA = config?.fallbackToA ?? true;
  }

  /**
   * Validate email domain for MX records
   */
  async validate(email: string): Promise<ValidatorResult> {
    try {
      // Basic checks
      if (!email || typeof email !== 'string') {
        throw new ValidationError(
          'Email must be a non-empty string',
          ErrorCode.MX_LOOKUP_FAILED,
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
          ErrorCode.MX_LOOKUP_FAILED,
          this.name
        );
      }

      // Perform DNS lookup
      const dnsResult = await performDNSLookup(domain, {
        timeout: this.timeout,
        retries: this.retries,
        fallbackToA: this.fallbackToA,
      });

      // Check if we have MX or A records
      if (!dnsResult.hasMX && !dnsResult.hasA) {
        return this.createErrorResult(
          new ValidationError(
            `No MX or A records found for domain ${domain}`,
            ErrorCode.MX_NOT_FOUND,
            this.name,
            {
              domain,
              mxRecords: [],
              aRecords: [],
            }
          )
        );
      }

      // Success - return result with details
      return this.createResult(true, {
        domain,
        mxRecords: dnsResult.mxRecords,
        aRecords: dnsResult.aRecords,
        hasMX: dnsResult.hasMX,
        hasA: dnsResult.hasA,
        quality: dnsResult.quality,
        recordCount: dnsResult.hasMX ? dnsResult.mxRecords.length : dnsResult.aRecords.length,
      });
    } catch (error) {
      // Handle DNS errors gracefully
      if (error instanceof ValidationError) {
        return this.createErrorResult(error);
      }

      // Extract domain for error details
      const domain = this.extractDomain(email);

      // Convert DNS errors to appropriate error type
      const errorMessage = error instanceof Error ? error.message : 'DNS lookup failed';

      // Check for NXDOMAIN/ENOTFOUND errors (domain doesn't exist)
      if (
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('NXDOMAIN') ||
        errorMessage.includes('not found')
      ) {
        return this.createErrorResult(
          new ValidationError(
            `No MX or A records found for domain ${domain}`,
            ErrorCode.MX_NOT_FOUND,
            this.name,
            {
              domain,
              originalError: errorMessage,
            }
          )
        );
      }

      // Check for timeout errors
      if (errorMessage.includes('timeout')) {
        return this.createErrorResult(
          new NetworkError(`DNS lookup timed out for domain ${domain}`, this.name, {
            domain,
            timeout: this.timeout,
            originalError: errorMessage,
          })
        );
      }

      // Other DNS errors
      return this.createErrorResult(
        new NetworkError(
          `Failed to lookup MX records for domain ${domain}: ${errorMessage}`,
          this.name,
          {
            domain,
            originalError: errorMessage,
          }
        )
      );
    }
  }
}
