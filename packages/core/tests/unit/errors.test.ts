import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  ConfigurationError,
  NetworkError,
  TimeoutError,
  createError,
  ERROR_MESSAGES,
} from '../../src/errors/errors';
import { ErrorCode } from '../../src/types';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create error with all properties', () => {
      const error = new ValidationError(
        'Test error',
        ErrorCode.REGEX_INVALID_FORMAT,
        'regex',
        { field: 'email' },
        'error'
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.REGEX_INVALID_FORMAT);
      expect(error.validator).toBe('regex');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.severity).toBe('error');
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create error with minimal properties', () => {
      const error = new ValidationError('Test error', ErrorCode.NETWORK_ERROR);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.validator).toBeUndefined();
      expect(error.details).toBeUndefined();
      expect(error.severity).toBe('error'); // Default
    });

    it('should convert to ValidationErrorType interface', () => {
      const error = new ValidationError(
        'Test error',
        ErrorCode.DISPOSABLE_DOMAIN,
        'disposable',
        { domain: 'mailinator.com' },
        'error'
      );

      const errorType = error.toValidationError();

      expect(errorType).toEqual({
        code: ErrorCode.DISPOSABLE_DOMAIN,
        message: 'Test error',
        severity: 'error',
        validator: 'disposable',
        details: { domain: 'mailinator.com' },
      });
    });

    it('should support custom error codes', () => {
      const error = new ValidationError('Custom error', 'CUSTOM_ERROR_CODE');

      expect(error.code).toBe('CUSTOM_ERROR_CODE');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error with default code', () => {
      const error = new ConfigurationError('Invalid config');

      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe(ErrorCode.INVALID_CONFIG);
      expect(error.name).toBe('ConfigurationError');
      expect(error.severity).toBe('error');
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should create configuration error with custom code', () => {
      const error = new ConfigurationError('Missing option', ErrorCode.MISSING_REQUIRED_OPTION, {
        option: 'timeout',
      });

      expect(error.message).toBe('Missing option');
      expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_OPTION);
      expect(error.details).toEqual({ option: 'timeout' });
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection failed', 'mx', {
        host: 'example.com',
      });

      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.validator).toBe('mx');
      expect(error.details).toEqual({ host: 'example.com' });
      expect(error.name).toBe('NetworkError');
      expect(error.severity).toBe('error');
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should create network error without validator', () => {
      const error = new NetworkError('DNS lookup failed');

      expect(error.message).toBe('DNS lookup failed');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.validator).toBeUndefined();
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('Operation timed out', 'smtp', 5000, {
        host: 'mail.example.com',
      });

      expect(error.message).toBe('Operation timed out');
      expect(error.code).toBe(ErrorCode.SMTP_TIMEOUT);
      expect(error.validator).toBe('smtp');
      expect(error.details).toEqual({
        timeout: 5000,
        host: 'mail.example.com',
      });
      expect(error.name).toBe('TimeoutError');
      expect(error.severity).toBe('error');
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should create timeout error without timeout value', () => {
      const error = new TimeoutError('Timeout occurred', 'mx');

      expect(error.message).toBe('Timeout occurred');
      expect(error.validator).toBe('mx');
      expect(error.details).toEqual({ timeout: undefined });
    });
  });

  describe('createError helper', () => {
    it('should create error from ErrorCode', () => {
      const error = createError(ErrorCode.REGEX_INVALID_FORMAT, 'regex');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.REGEX_INVALID_FORMAT);
      expect(error.validator).toBe('regex');
      expect(error.message).toBe('Email format is invalid');
      expect(error.severity).toBe('error');
    });

    it('should include suggestion from template', () => {
      const error = createError(ErrorCode.REGEX_INVALID_FORMAT);

      expect(error.message).toBe('Email format is invalid');
      // Note: suggestion is in ERROR_MESSAGES but not directly on error
      // It would be used when converting to ValidationErrorType
    });

    it('should handle typo error with function suggestion', () => {
      const error = createError(ErrorCode.TYPO_DETECTED, 'typo', {
        suggestion: 'gmail.com',
      });

      expect(error.code).toBe(ErrorCode.TYPO_DETECTED);
      expect(error.severity).toBe('warning');
    });

    it('should handle custom error code', () => {
      const error = createError('CUSTOM_ERROR', 'custom');

      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('An error occurred'); // Default message
      expect(error.severity).toBe('error'); // Default severity
    });

    it('should include details in error', () => {
      const error = createError(ErrorCode.MX_LOOKUP_FAILED, 'mx', {
        domain: 'example.com',
        attempts: 3,
      });

      expect(error.details).toEqual({
        domain: 'example.com',
        attempts: 3,
      });
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have messages for all ErrorCode values', () => {
      const errorCodes = Object.values(ErrorCode);

      for (const code of errorCodes) {
        const message = ERROR_MESSAGES[code];
        expect(message).toBeDefined();
        expect(message!.message).toBeTruthy();
        expect(message!.severity).toMatch(/^(warning|error|critical)$/);
      }
    });

    it('should have appropriate severity levels', () => {
      expect(ERROR_MESSAGES[ErrorCode.TYPO_DETECTED]?.severity).toBe('warning');
      expect(ERROR_MESSAGES[ErrorCode.RATE_LIMIT_EXCEEDED]?.severity).toBe('warning');
      expect(ERROR_MESSAGES[ErrorCode.REGEX_INVALID_FORMAT]?.severity).toBe('error');
      expect(ERROR_MESSAGES[ErrorCode.SMTP_MAILBOX_NOT_FOUND]?.severity).toBe('error');
    });

    it('should have suggestions for most errors', () => {
      expect(ERROR_MESSAGES[ErrorCode.REGEX_INVALID_FORMAT]?.suggestion).toBeDefined();
      expect(ERROR_MESSAGES[ErrorCode.DISPOSABLE_DOMAIN]?.suggestion).toBeDefined();
      expect(ERROR_MESSAGES[ErrorCode.MX_NOT_FOUND]?.suggestion).toBeDefined();
    });

    it('should have function suggestions for typo errors', () => {
      const typoMessage = ERROR_MESSAGES[ErrorCode.TYPO_DETECTED];
      expect(typoMessage).toBeDefined();
      expect(typeof typoMessage!.suggestion).toBe('function');

      const suggestionFn = typoMessage!.suggestion;
      if (typeof suggestionFn === 'function') {
        const suggestion = suggestionFn({ suggestion: 'gmail.com' });
        expect(suggestion).toBe('Did you mean gmail.com?');
      }
    });
  });

  describe('error inheritance', () => {
    it('should maintain Error prototype chain', () => {
      const validationError = new ValidationError('Test', ErrorCode.NETWORK_ERROR);
      const configError = new ConfigurationError('Test');
      const networkError = new NetworkError('Test');
      const timeoutError = new TimeoutError('Test');

      expect(validationError).toBeInstanceOf(Error);
      expect(configError).toBeInstanceOf(Error);
      expect(configError).toBeInstanceOf(ValidationError);
      expect(networkError).toBeInstanceOf(Error);
      expect(networkError).toBeInstanceOf(ValidationError);
      expect(timeoutError).toBeInstanceOf(Error);
      expect(timeoutError).toBeInstanceOf(ValidationError);
    });
  });
});
