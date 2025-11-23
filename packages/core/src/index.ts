/**
 * @mailtest/core - Modern email validation library
 *
 * @packageDocumentation
 */

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

// Export validators
export { BaseValidator, RegexValidator } from './validators';
export type { RegexValidatorConfig } from './validators';

/**
 * Placeholder function for initial setup
 * Will be replaced with actual validation logic in Phase 5
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic validation placeholder
  return email.includes('@');
}

/**
 * Library version
 */
export const VERSION = '1.0.0';
