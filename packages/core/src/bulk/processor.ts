/**
 * Bulk Validation Processor for mailtester
 *
 * Handles concurrent validation of multiple email addresses with
 * configurable concurrency limits and progress tracking.
 *
 * @packageDocumentation
 */

import type { Config } from '../config/config';
import type { ValidationResult } from '../types';
import { validate } from '../index';
import { getLogger } from '../utils/logger';
import { RateLimiter, type RateLimiterOptions } from '../rate-limit/limiter';

const logger = getLogger();

/**
 * Options for bulk validation
 */
export interface BulkValidationOptions {
  /** Maximum number of concurrent validations (default: 10) */
  concurrency?: number;

  /** Continue processing even if individual validations fail (default: true) */
  continueOnError?: boolean;

  /** Callback function called when progress updates */
  onProgress?: (completed: number, total: number) => void;

  /** Configuration to use for all validations */
  config?: Config;

  /** Rate limiting configuration */
  rateLimit?: RateLimiterOptions;
}

/**
 * Result of bulk validation
 */
export interface BulkValidationResult {
  /** Array of validation results, one per email */
  results: ValidationResult[];

  /** Total number of emails processed */
  total: number;

  /** Number of valid emails */
  valid: number;

  /** Number of invalid emails */
  invalid: number;

  /** Number of errors encountered */
  errors: number;

  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Bulk Validation Processor
 *
 * Processes multiple email addresses concurrently with configurable
 * concurrency limits and progress tracking.
 *
 * @example
 * ```typescript
 * const processor = new BulkProcessor();
 * const emails = ['user1@example.com', 'user2@example.com'];
 * const result = await processor.process(emails, {
 *   concurrency: 5,
 *   onProgress: (completed, total) => console.log(`${completed}/${total}`)
 * });
 * ```
 */
export class BulkProcessor {
  private rateLimiter: RateLimiter | null = null;

  /**
   * Process multiple email addresses concurrently
   *
   * @param emails - Array of email addresses to validate
   * @param options - Bulk validation options
   * @returns Bulk validation result with all individual results
   */
  async process(
    emails: string[],
    options: BulkValidationOptions = {}
  ): Promise<BulkValidationResult> {
    const startTime = Date.now();
    const { concurrency = 10, continueOnError = true, onProgress, config, rateLimit } = options;

    // Initialize rate limiter if configured
    if (rateLimit) {
      this.rateLimiter = new RateLimiter(rateLimit);
    }

    // Validate inputs
    if (!Array.isArray(emails)) {
      throw new TypeError('emails must be an array');
    }

    if (emails.length === 0) {
      return {
        results: [],
        total: 0,
        valid: 0,
        invalid: 0,
        errors: 0,
        duration: 0,
      };
    }

    if (concurrency < 1) {
      throw new RangeError('concurrency must be at least 1');
    }

    logger.debug(`Starting bulk validation: ${emails.length} emails, concurrency: ${concurrency}`);

    const results: ValidationResult[] = [];
    let completed = 0;
    let validCount = 0;
    let invalidCount = 0;
    let errorCount = 0;

    // Process emails in batches with concurrency limit
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);

      // Process batch concurrently
      const batchPromises = batch.map(async (email, batchIndex) => {
        const globalIndex = i + batchIndex;

        try {
          // Check rate limit before validation
          if (this.rateLimiter) {
            const rateLimitCheck = await this.rateLimiter.check(email);

            if (!rateLimitCheck.allowed) {
              // Rate limit exceeded
              const errorResult: ValidationResult = {
                valid: false,
                email,
                score: 0,
                reason: 'rate-limit',
                validators: {},
                metadata: {
                  timestamp: new Date().toISOString(),
                  duration: 0,
                },
              };

              results[globalIndex] = errorResult;
              invalidCount++;
              completed++;

              if (onProgress) {
                onProgress(completed, emails.length);
              }

              if (continueOnError) {
                logger.warn(
                  `Rate limit exceeded for ${email}. Wait ${rateLimitCheck.waitTime}s before retrying.`
                );
                return errorResult;
              }

              throw rateLimitCheck.error || new Error('Rate limit exceeded');
            }
          }

          const result = await validate(email, config);
          results[globalIndex] = result;

          if (result.valid) {
            validCount++;
          } else {
            invalidCount++;
          }

          completed++;
          if (onProgress) {
            onProgress(completed, emails.length);
          }

          return result;
        } catch (error) {
          errorCount++;

          // Create error result
          const errorResult: ValidationResult = {
            valid: false,
            email,
            score: 0,
            reason: 'custom',
            validators: {},
            metadata: {
              timestamp: new Date().toISOString(),
              duration: 0,
            },
          };

          results[globalIndex] = errorResult;
          completed++;

          if (onProgress) {
            onProgress(completed, emails.length);
          }

          if (continueOnError) {
            logger.warn(`Error validating ${email}:`, error);
            return errorResult;
          }

          throw error;
        }
      });

      // Wait for batch to complete
      if (continueOnError) {
        await Promise.allSettled(batchPromises);
      } else {
        await Promise.all(batchPromises);
      }
    }

    const duration = Date.now() - startTime;

    logger.debug(`Bulk validation completed: ${completed}/${emails.length} in ${duration}ms`);

    return {
      results,
      total: emails.length,
      valid: validCount,
      invalid: invalidCount,
      errors: errorCount,
      duration,
    };
  }
}
