/**
 * Custom error classes for mailtester
 *
 * @packageDocumentation
 */

import {
  ErrorCode,
  type ErrorSeverity,
  type ValidationError as ValidationErrorType,
} from '../types';

// Re-export ErrorCode for convenience
export { ErrorCode };

/**
 * Base validation error class
 *
 * All custom errors extend this class for consistent error handling
 */
export class ValidationError extends Error {
  public readonly code: ErrorCode | string;
  public readonly validator: string | undefined;
  public readonly details: unknown | undefined;
  public readonly severity: ErrorSeverity;

  constructor(
    message: string,
    code: ErrorCode | string,
    validator?: string,
    details?: unknown,
    severity: ErrorSeverity = 'error'
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.validator = validator;
    this.details = details;
    this.severity = severity;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Convert error to ValidationErrorType interface
   */
  toValidationError(): ValidationErrorType {
    const result: ValidationErrorType = {
      code: this.code,
      message: this.message,
      severity: this.severity,
    };

    if (this.validator !== undefined) {
      result.validator = this.validator;
    }

    if (this.details !== undefined) {
      result.details = this.details;
    }

    return result;
  }
}

/**
 * Configuration error
 *
 * Thrown when configuration is invalid or missing required options
 */
export class ConfigurationError extends ValidationError {
  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_CONFIG, details?: unknown) {
    super(message, code, undefined, details, 'error');
    this.name = 'ConfigurationError';
  }
}

/**
 * Network error
 *
 * Thrown when network operations fail (DNS, SMTP connection, etc.)
 */
export class NetworkError extends ValidationError {
  constructor(message: string, validator?: string, details?: unknown) {
    super(message, ErrorCode.NETWORK_ERROR, validator, details, 'error');
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 *
 * Thrown when an operation exceeds the configured timeout
 */
export class TimeoutError extends ValidationError {
  constructor(message: string, validator?: string, timeout?: number, details?: unknown) {
    super(
      message,
      ErrorCode.SMTP_TIMEOUT,
      validator,
      { timeout, ...(details as Record<string, unknown>) },
      'error'
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Error message templates
 *
 * Provides consistent error messages with helpful suggestions
 */
export const ERROR_MESSAGES: Record<
  ErrorCode | string,
  {
    message: string;
    suggestion?: string | ((details?: unknown) => string);
    severity: ErrorSeverity;
  }
> = {
  // Configuration errors
  [ErrorCode.INVALID_CONFIG]: {
    message: 'Invalid configuration provided',
    suggestion: 'Check your configuration object for invalid values',
    severity: 'error',
  },
  [ErrorCode.MISSING_REQUIRED_OPTION]: {
    message: 'Missing required configuration option',
    suggestion: 'Check the documentation for required configuration options',
    severity: 'error',
  },

  // Validation errors
  [ErrorCode.REGEX_INVALID_FORMAT]: {
    message: 'Email format is invalid',
    suggestion: 'Ensure email contains @ symbol and domain with extension',
    severity: 'error',
  },
  [ErrorCode.TYPO_DETECTED]: {
    message: 'Possible typo in email domain',
    suggestion: (details?: unknown) => {
      const suggestion = (details as { suggestion?: string })?.suggestion;
      return suggestion ? `Did you mean ${suggestion}?` : 'Check the domain spelling';
    },
    severity: 'warning',
  },
  [ErrorCode.DISPOSABLE_DOMAIN]: {
    message: 'Disposable email addresses are not allowed',
    suggestion: 'Please use a permanent email address',
    severity: 'error',
  },
  [ErrorCode.MX_NOT_FOUND]: {
    message: 'No MX records found for domain',
    suggestion: 'Verify the domain exists and has mail servers configured',
    severity: 'error',
  },
  [ErrorCode.MX_LOOKUP_FAILED]: {
    message: 'Failed to lookup MX records',
    suggestion: 'Check your network connection and DNS settings',
    severity: 'error',
  },
  [ErrorCode.SMTP_MAILBOX_NOT_FOUND]: {
    message: 'Email address does not exist',
    suggestion: 'Verify the email address is correct',
    severity: 'error',
  },
  [ErrorCode.SMTP_CONNECTION_FAILED]: {
    message: 'Failed to connect to mail server',
    suggestion: 'The mail server may be temporarily unavailable',
    severity: 'error',
  },
  [ErrorCode.SMTP_TIMEOUT]: {
    message: 'SMTP validation timed out',
    suggestion: 'The mail server may be slow or unreachable',
    severity: 'error',
  },

  // System errors
  [ErrorCode.CACHE_ERROR]: {
    message: 'Cache operation failed',
    suggestion: 'Check cache configuration',
    severity: 'warning',
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    message: 'Rate limit exceeded',
    suggestion: 'Wait before retrying or adjust rate limit settings',
    severity: 'warning',
  },
  [ErrorCode.PLUGIN_ERROR]: {
    message: 'Plugin error occurred',
    suggestion: 'Check plugin configuration and logs',
    severity: 'error',
  },
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Network error occurred',
    suggestion: 'Check your network connection and try again',
    severity: 'error',
  },
};

/**
 * Create a ValidationError from an ErrorCode
 *
 * @param code - Error code
 * @param validator - Optional validator name
 * @param details - Optional additional details
 * @returns ValidationError instance
 */
export function createError(
  code: ErrorCode | string,
  validator?: string,
  details?: unknown
): ValidationError {
  const template = ERROR_MESSAGES[code] ?? {
    message: 'An error occurred',
    severity: 'error' as ErrorSeverity,
  };

  const message = template.message;
  const severity = template.severity;

  return new ValidationError(message, code, validator, details, severity);
}
