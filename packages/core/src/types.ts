/**
 * Core type definitions for mailtester
 *
 * @packageDocumentation
 */

/**
 * Error codes used throughout the validation library
 */
export enum ErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_REQUIRED_OPTION = 'MISSING_REQUIRED_OPTION',

  // Validation errors
  REGEX_INVALID_FORMAT = 'REGEX_INVALID_FORMAT',
  TYPO_DETECTED = 'TYPO_DETECTED',
  DISPOSABLE_DOMAIN = 'DISPOSABLE_DOMAIN',
  MX_NOT_FOUND = 'MX_NOT_FOUND',
  MX_LOOKUP_FAILED = 'MX_LOOKUP_FAILED',
  SMTP_MAILBOX_NOT_FOUND = 'SMTP_MAILBOX_NOT_FOUND',
  SMTP_CONNECTION_FAILED = 'SMTP_CONNECTION_FAILED',
  SMTP_TIMEOUT = 'SMTP_TIMEOUT',

  // System errors
  CACHE_ERROR = 'CACHE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PLUGIN_ERROR = 'PLUGIN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'warning' | 'error' | 'critical';

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error code from ErrorCode enum */
  code: ErrorCode | string;

  /** Human-readable error message */
  message: string;

  /** Optional helpful suggestion for the user */
  suggestion?: string;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Name of the validator that produced this error */
  validator?: string;

  /** Additional error details */
  details?: unknown;
}

/**
 * Result from an individual validator
 */
export interface ValidatorResult {
  /** Whether the validator passed */
  valid: boolean;

  /** Name of the validator */
  validator: string;

  /** Error details if validation failed */
  error?: ValidationError;

  /** Additional validator-specific data */
  details?: Record<string, unknown>;
}

/**
 * Main validation result returned by validate() function
 */
export interface ValidationResult {
  /** Whether the email is valid overall */
  valid: boolean;

  /** The email address that was validated */
  email: string;

  /** Reputation score (0-100) */
  score: number;

  /** Which validator failed (if invalid) */
  reason?: 'regex' | 'typo' | 'disposable' | 'mx' | 'smtp' | 'custom' | 'rate-limit';

  /** Results from each validator */
  validators: {
    regex?: ValidatorResult;
    typo?: ValidatorResult;
    disposable?: ValidatorResult;
    mx?: ValidatorResult;
    smtp?: ValidatorResult;
    [customValidator: string]: ValidatorResult | undefined;
  };

  /** Optional metadata about the validation */
  metadata?: {
    /** Timestamp when validation completed (ISO 8601 string) */
    timestamp?: string;

    /** Duration of validation in milliseconds */
    duration?: number;
  };
}

/**
 * Base configuration for individual validators
 */
export interface ValidatorConfig {
  /** Whether this validator is enabled */
  enabled: boolean;
}

/**
 * Options for validating a single email
 */
export interface ValidatorOptions {
  /** Email address to validate */
  email: string;

  /** Validator-specific configurations */
  validators?: {
    regex?: ValidatorConfig | boolean;
    typo?: ValidatorConfig | boolean;
    disposable?: ValidatorConfig | boolean;
    mx?: ValidatorConfig | boolean;
    smtp?: ValidatorConfig | boolean;
    [key: string]: ValidatorConfig | boolean | undefined;
  };

  /** Stop validation on first failure */
  earlyExit?: boolean;

  /** Timeout for entire validation in milliseconds */
  timeout?: number;
}
