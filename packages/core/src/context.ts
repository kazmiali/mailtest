/**
 * Validation Context for mailtest
 *
 * Stores email, configuration, and intermediate validation results
 * during the validation pipeline execution.
 *
 * @packageDocumentation
 */

import type { MergedConfig } from './config/config';
import type { ValidatorResult } from './types';

/**
 * Validation context that holds state during validation pipeline execution
 */
export interface ValidationContext {
  /** The email address being validated */
  email: string;

  /** The merged configuration for this validation */
  config: MergedConfig;

  /** Intermediate results from validators (populated as validators run) */
  results: {
    regex?: ValidatorResult;
    typo?: ValidatorResult;
    disposable?: ValidatorResult;
    mx?: ValidatorResult;
    smtp?: ValidatorResult;
    [customValidator: string]: ValidatorResult | undefined;
  };

  /** Timestamp when validation started (for performance tracking) */
  startTime: number;
}

/**
 * Create a new validation context
 *
 * @param email - Email address to validate
 * @param config - Merged configuration
 * @returns New validation context
 */
export function createContext(email: string, config: MergedConfig): ValidationContext {
  return {
    email,
    config,
    results: {},
    startTime: Date.now(),
  };
}
