/**
 * @mailtester/core - Modern email validation library
 *
 * @packageDocumentation
 */

import { ConfigManager, type Config, type MergedConfig } from './config/config';
import { createContext } from './context';
import { ValidationOrchestrator } from './orchestrator';
import type { ValidationResult } from './types';
import { BulkProcessor } from './bulk';
import type { BulkValidationOptions, BulkValidationResult } from './bulk';

/**
 * Validator instance returned by createValidator()
 */
export interface ValidatorInstance {
  /**
   * Validate an email address using this validator's configuration
   *
   * @param email - Email address to validate
   * @returns Validation result with validity, score, and validator details
   */
  validate(email: string): Promise<ValidationResult>;

  /**
   * Get the current configuration
   *
   * @returns Merged configuration object
   */
  getConfig(): MergedConfig;
}

// Export all core types
export type {
  ValidationResult,
  ValidatorResult,
  ValidatorConfig,
  ValidatorOptions,
  ValidationError as ValidationErrorType,
  ErrorSeverity,
} from './types';

export { ErrorCode } from './types';

// Export configuration manager
export { ConfigManager } from './config/config';
export type { Config, MergedConfig } from './config/config';

// Export validation context
export { createContext } from './context';
export type { ValidationContext } from './context';

// Export orchestrator
export { ValidationOrchestrator } from './orchestrator';

// Export formatter
export { ResultFormatter } from './output/formatter';

// Export error classes
export {
  ValidationError,
  ConfigurationError,
  NetworkError,
  TimeoutError,
  createError,
  ERROR_MESSAGES,
} from './errors/errors';

// Export logger utility
export { Logger, createLogger, getLogger } from './utils/logger';
export type { LogLevel, LoggerConfig } from './utils/logger';

// Export bulk validation
export { BulkProcessor } from './bulk';
export type { BulkValidationOptions, BulkValidationResult } from './bulk';

// Export rate limiter
export { RateLimiter } from './rate-limit/limiter';
export type { RateLimitConfig, RateLimiterOptions } from './rate-limit/limiter';

// Export validators
export {
  BaseValidator,
  RegexValidator,
  TypoValidator,
  DisposableValidator,
  MXValidator,
  SMTPValidator,
} from './validators';
export type {
  RegexValidatorConfig,
  TypoValidatorConfig,
  DisposableValidatorConfig,
  MXValidatorConfig,
  SMTPValidatorConfig,
} from './validators';

/**
 * Simple email validation function
 *
 * Validates an email address using the default configuration (strict preset - all validators enabled).
 * For custom configuration, use `createValidator()` instead.
 *
 * @param email - Email address to validate
 * @param options - Optional validation configuration
 * @returns Validation result with validity, score, and validator details
 *
 * @example
 * ```typescript
 * const result = await validate('user@example.com');
 * console.log(result.valid); // true
 * console.log(result.score); // 95
 * ```
 *
 * @example
 * ```typescript
 * const result = await validate('user@example.com', {
 *   preset: 'strict',
 *   earlyExit: true
 * });
 * ```
 */
export async function validate(email: string, options?: Config): Promise<ValidationResult> {
  // Create config manager with options
  const configManager = new ConfigManager(options);
  const config = configManager.get();

  // Create validation context
  const context = createContext(email, config);

  // Run validation through orchestrator
  const orchestrator = new ValidationOrchestrator();
  return await orchestrator.validate(context);
}

/**
 * Create a validator instance with custom configuration
 *
 * Returns a validator object with a `validate()` method that uses the provided configuration.
 * Useful when you need to validate multiple emails with the same configuration.
 *
 * @param config - Configuration object or preset name
 * @returns Validator instance with validate() method
 *
 * @example
 * ```typescript
 * const validator = createValidator({ preset: 'strict' });
 * const result = await validator.validate('user@example.com');
 * ```
 *
 * @example
 * ```typescript
 * const validator = createValidator({
 *   validators: {
 *     regex: { enabled: true },
 *     smtp: { enabled: false }
 *   },
 *   earlyExit: true
 * });
 * const result = await validator.validate('user@example.com');
 * ```
 */
export function createValidator(config?: Config): ValidatorInstance {
  // Create config manager with provided config
  const configManager = new ConfigManager(config);
  const mergedConfig = configManager.get();

  // Create orchestrator instance
  const orchestrator = new ValidationOrchestrator();

  return {
    /**
     * Validate an email address using this validator's configuration
     *
     * @param email - Email address to validate
     * @returns Validation result with validity, score, and validator details
     */
    async validate(email: string): Promise<ValidationResult> {
      // Create validation context
      const context = createContext(email, mergedConfig);

      // Run validation through orchestrator
      return await orchestrator.validate(context);
    },

    /**
     * Get the current configuration
     *
     * @returns Merged configuration object
     */
    getConfig(): MergedConfig {
      return mergedConfig;
    },
  };
}

/**
 * Bulk email validation function
 *
 * Validates multiple email addresses concurrently with configurable
 * concurrency limits, progress tracking, and rate limiting.
 *
 * @param emails - Array of email addresses to validate
 * @param options - Optional bulk validation configuration
 * @returns Bulk validation result with all individual results and statistics
 *
 * @example
 * ```typescript
 * const emails = ['user1@example.com', 'user2@example.com'];
 * const result = await validateBulk(emails);
 * console.log(result.valid); // 2
 * console.log(result.results[0].valid); // true
 * ```
 *
 * @example
 * ```typescript
 * const emails = Array(100).fill(0).map((_, i) => `user${i}@gmail.com`);
 * const result = await validateBulk(emails, {
 *   concurrency: 10,
 *   onProgress: (completed, total) => {
 *     console.log(`Progress: ${completed}/${total}`);
 *   },
 *   config: { preset: 'balanced' }
 * });
 * ```
 *
 * @example
 * ```typescript
 * const result = await validateBulk(emails, {
 *   continueOnError: true,
 *   rateLimit: {
 *     global: { requests: 100, window: 60 }
 *   }
 * });
 * ```
 */
export async function validateBulk(
  emails: string[],
  options?: BulkValidationOptions
): Promise<BulkValidationResult> {
  const processor = new BulkProcessor();
  return await processor.process(emails, options);
}

/**
 * Library version
 */
export const VERSION = '1.0.0';
