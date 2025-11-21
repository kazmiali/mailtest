/**
 * Core type definitions for mailtest
 *
 * @packageDocumentation
 */

/**
 * Validation result interface
 * This will be expanded as we implement validators
 */
export interface ValidationResult {
  valid: boolean;
  email: string;
}

/**
 * Validator options interface
 * This will be expanded with specific validator configurations
 */
export interface ValidatorOptions {
  enabled?: boolean;
}

/**
 * Main configuration interface
 * This will be expanded as we add more features
 */
export interface Config {
  validators?: {
    [key: string]: ValidatorOptions;
  };
}
