/**
 * Rate Limiting for mailtester
 *
 * Implements token bucket algorithm for per-domain and global rate limiting
 * to protect external services and avoid blacklisting.
 *
 * @packageDocumentation
 */

import { ErrorCode } from '../types';
import { createError } from '../errors/errors';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  requests: number;

  /** Time window in seconds */
  window: number;
}

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  /** Per-domain rate limit configuration */
  perDomain?: RateLimitConfig;

  /** Global rate limit configuration */
  global?: RateLimitConfig;

  /** Enable rate limiting (default: true) */
  enabled?: boolean;
}

/**
 * Token bucket state
 */
interface TokenBucket {
  /** Current number of tokens */
  tokens: number;

  /** Maximum capacity of the bucket */
  capacity: number;

  /** Last refill timestamp in milliseconds */
  lastRefill: number;

  /** Refill rate (tokens per second) */
  refillRate: number;
}

/**
 * Rate Limiter using Token Bucket Algorithm
 *
 * Implements a token bucket algorithm for rate limiting requests.
 * Supports both per-domain and global rate limiting.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   perDomain: { requests: 10, window: 60 }, // 10 per minute per domain
 *   global: { requests: 100, window: 60 }   // 100 per minute total
 * });
 *
 * // Check if request is allowed
 * const allowed = await limiter.check('example.com');
 * if (!allowed.allowed) {
 *   throw new Error('Rate limit exceeded');
 * }
 * ```
 */
export class RateLimiter {
  private perDomainBuckets: Map<string, TokenBucket>;
  private globalBucket: TokenBucket | null;
  private enabled: boolean;

  /**
   * Create a new rate limiter
   *
   * @param options - Rate limiter configuration
   */
  constructor(options: RateLimiterOptions = {}) {
    const { perDomain, global, enabled = true } = options;

    this.perDomainBuckets = new Map();
    this.enabled = enabled;

    // Initialize global bucket if configured
    if (global) {
      this.globalBucket = this.createBucket(global.requests, global.window);
    } else {
      this.globalBucket = null;
    }

    // Store per-domain config for creating buckets on-demand
    this.perDomainConfig = perDomain ?? undefined;
  }

  private perDomainConfig: RateLimitConfig | undefined;

  /**
   * Create a new token bucket
   *
   * @param capacity - Maximum number of tokens
   * @param window - Time window in seconds
   * @returns Token bucket instance
   */
  private createBucket(capacity: number, window: number): TokenBucket {
    const refillRate = capacity / window; // tokens per second

    return {
      tokens: capacity,
      capacity,
      lastRefill: Date.now(),
      refillRate,
    };
  }

  /**
   * Refill tokens in a bucket based on elapsed time
   *
   * @param bucket - Token bucket to refill
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds

    if (elapsed <= 0) {
      return;
    }

    // Add tokens based on refill rate
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Get or create a per-domain bucket
   *
   * @param domain - Domain name
   * @returns Token bucket for the domain
   */
  private getDomainBucket(domain: string): TokenBucket | null {
    if (!this.perDomainConfig) {
      return null;
    }

    let bucket = this.perDomainBuckets.get(domain);

    if (!bucket) {
      bucket = this.createBucket(this.perDomainConfig.requests, this.perDomainConfig.window);
      this.perDomainBuckets.set(domain, bucket);
    }

    return bucket;
  }

  /**
   * Extract domain from email address
   *
   * @param email - Email address
   * @returns Domain name or null if invalid
   */
  private extractDomain(email: string): string | null {
    const parts = email.split('@');
    if (parts.length !== 2) {
      return null;
    }
    return parts[1]?.toLowerCase() || null;
  }

  /**
   * Check if a request is allowed
   *
   * @param email - Email address to check (for domain extraction)
   * @returns Result indicating if request is allowed and wait time if not
   */
  async check(email: string): Promise<{
    allowed: boolean;
    waitTime?: number;
    error?: ReturnType<typeof createError>;
  }> {
    if (!this.enabled) {
      return { allowed: true };
    }

    const domain = this.extractDomain(email);
    if (!domain) {
      // Invalid email format, allow it (will be caught by regex validator)
      return { allowed: true };
    }

    // Check global rate limit first
    if (this.globalBucket) {
      this.refillBucket(this.globalBucket);

      if (this.globalBucket.tokens < 1) {
        const waitTime = Math.ceil((1 - this.globalBucket.tokens) / this.globalBucket.refillRate);

        logger.warn(`Global rate limit exceeded. Wait ${waitTime}s before retrying.`);

        return {
          allowed: false,
          waitTime,
          error: createError(ErrorCode.RATE_LIMIT_EXCEEDED, undefined, {
            type: 'global',
            waitTime,
          }),
        };
      }

      // Consume token
      this.globalBucket.tokens -= 1;
    }

    // Check per-domain rate limit
    const domainBucket = this.getDomainBucket(domain);
    if (domainBucket) {
      this.refillBucket(domainBucket);

      if (domainBucket.tokens < 1) {
        const waitTime = Math.ceil((1 - domainBucket.tokens) / domainBucket.refillRate);

        logger.warn(`Rate limit exceeded for domain ${domain}. Wait ${waitTime}s before retrying.`);

        return {
          allowed: false,
          waitTime,
          error: createError(ErrorCode.RATE_LIMIT_EXCEEDED, undefined, {
            type: 'per-domain',
            domain,
            waitTime,
          }),
        };
      }

      // Consume token
      domainBucket.tokens -= 1;
    }

    return { allowed: true };
  }

  /**
   * Reset rate limits (useful for testing)
   */
  reset(): void {
    this.perDomainBuckets.clear();

    if (this.globalBucket) {
      this.globalBucket.tokens = this.globalBucket.capacity;
      this.globalBucket.lastRefill = Date.now();
    }
  }

  /**
   * Get statistics about rate limiter state
   *
   * @returns Statistics object
   */
  getStats(): {
    enabled: boolean;
    globalBucket?: {
      tokens: number;
      capacity: number;
      refillRate: number;
    };
    domainBuckets: number;
  } {
    const stats: {
      enabled: boolean;
      globalBucket?: {
        tokens: number;
        capacity: number;
        refillRate: number;
      };
      domainBuckets: number;
    } = {
      enabled: this.enabled,
      domainBuckets: this.perDomainBuckets.size,
    };

    if (this.globalBucket) {
      stats.globalBucket = {
        tokens: this.globalBucket.tokens,
        capacity: this.globalBucket.capacity,
        refillRate: this.globalBucket.refillRate,
      };
    }

    return stats;
  }
}
