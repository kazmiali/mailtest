/**
 * Base Validator Class
 *
 * Abstract base class that all validators must extend.
 * Provides common functionality like caching, error handling, and consistent result formatting.
 */

import type { ValidatorResult, ValidatorConfig } from '../types';
import { ValidationError } from '../errors/errors';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Abstract base class for all validators
 *
 * @example
 * ```typescript
 * class MyValidator extends BaseValidator {
 *   constructor(options?: ValidatorConfig) {
 *     super('my-validator', options);
 *   }
 *
 *   async validate(email: string): Promise<ValidatorResult> {
 *     try {
 *       const isValid = this.performCheck(email);
 *       return this.createResult(isValid);
 *     } catch (error) {
 *       return this.handleError(error);
 *     }
 *   }
 *
 *   private performCheck(email: string): boolean {
 *     return true;
 *   }
 * }
 * ```
 */
export abstract class BaseValidator {
  /**
   * Name of the validator (e.g., 'regex', 'smtp', 'mx')
   */
  protected readonly name: string;

  /**
   * Configuration for this validator
   */
  protected readonly config: ValidatorConfig;

  /**
   * Create a new validator instance
   *
   * @param name - Unique name for this validator
   * @param config - Optional configuration
   */
  constructor(name: string, config?: ValidatorConfig) {
    this.name = name;
    this.config = { enabled: true, ...config };
  }

  /**
   * Validate an email address
   *
   * Must be implemented by subclasses
   *
   * @param email - Email address to validate
   * @returns Validation result
   */
  abstract validate(email: string): Promise<ValidatorResult>;

  /**
   * Get the name of this validator
   */
  getName(): string {
    return this.name;
  }

  /**
   * Check if this validator is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the configuration for this validator
   */
  getConfig(): ValidatorConfig {
    return { ...this.config };
  }

  /**
   * Create a successful validation result
   *
   * @param details - Optional additional details
   * @returns Validation result
   */
  protected createResult(valid: boolean, details?: Record<string, unknown>): ValidatorResult {
    const result: ValidatorResult = {
      valid,
      validator: this.name,
    };

    if (details) {
      result.details = details;
    }

    return result;
  }

  /**
   * Create a failed validation result with error
   *
   * @param error - Error that occurred
   * @returns Validation result with error
   */
  protected createErrorResult(error: ValidationError): ValidatorResult {
    return {
      valid: false,
      validator: this.name,
      error: error.toValidationError(),
    };
  }

  /**
   * Handle errors during validation
   *
   * Converts any error into a proper ValidationError and creates a result
   *
   * @param error - Error that occurred
   * @returns Validation result with error
   */
  protected handleError(error: unknown): ValidatorResult {
    logger.error(`[${this.name}] Validation error:`, error);

    // If it's already a ValidationError, use it
    if (error instanceof ValidationError) {
      return this.createErrorResult(error);
    }

    // Convert other errors to ValidationError
    const validationError = new ValidationError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      'VALIDATION_ERROR',
      this.name,
      { originalError: error }
    );

    return this.createErrorResult(validationError);
  }

  /**
   * Normalize email address for validation
   *
   * Trims whitespace and converts to lowercase (for domain only)
   *
   * @param email - Email address to normalize
   * @returns Normalized email address
   */
  protected normalizeEmail(email: string): string {
    const trimmed = email.trim();

    // Split email into local and domain parts
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex === -1) {
      return trimmed;
    }

    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1).toLowerCase();

    return `${local}@${domain}`;
  }

  /**
   * Extract domain from email address
   *
   * @param email - Email address
   * @returns Domain part or empty string if invalid
   */
  protected extractDomain(email: string): string {
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) {
      return '';
    }

    return email.slice(atIndex + 1).toLowerCase();
  }

  /**
   * Extract local part from email address
   *
   * @param email - Email address
   * @returns Local part or empty string if invalid
   */
  protected extractLocal(email: string): string {
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) {
      return '';
    }

    return email.slice(0, atIndex);
  }
}
