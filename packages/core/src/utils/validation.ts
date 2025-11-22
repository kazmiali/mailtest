/**
 * Custom validation utilities
 * Replaces Zod with lightweight, dependency-free validators
 *
 * @packageDocumentation
 */

/**
 * Validation result matching Zod's safeParse API
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

/**
 * Simple email regex (RFC 5322 compliant subset)
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Check if value is a string
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is an object (not null, not array)
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Create a success result
 */
function success<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

/**
 * Create an error result
 */
function error(message: string): ValidationResult<never> {
  return { success: false, error: { message } };
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  errorMessage: string
): ValidationResult<T> {
  if (!isString(value)) {
    return error(`Expected string, got ${typeof value}`);
  }
  if (!allowedValues.includes(value as T)) {
    return error(errorMessage);
  }
  return success(value as T);
}

/**
 * Validate string with minimum length
 */
export function validateString(
  value: unknown,
  minLength = 0,
  errorMessage?: string
): ValidationResult<string> {
  if (!isString(value)) {
    return error(`Expected string, got ${typeof value}`);
  }
  if (value.length < minLength) {
    return error(errorMessage || `String must be at least ${minLength} character(s)`);
  }
  return success(value);
}

/**
 * Validate email string
 */
export function validateEmail(
  value: unknown,
  errorMessage = 'Invalid email format'
): ValidationResult<string> {
  const stringResult = validateString(value, 1);
  if (!stringResult.success) {
    return stringResult;
  }
  if (!isValidEmail(stringResult.data)) {
    return error(errorMessage);
  }
  return success(stringResult.data);
}

/**
 * Validate number (integer)
 */
export function validateInteger(
  value: unknown,
  min?: number,
  max?: number,
  errorMessage?: string
): ValidationResult<number> {
  if (!isNumber(value)) {
    return error(`Expected number, got ${typeof value}`);
  }
  if (!Number.isInteger(value)) {
    return error(errorMessage || 'Expected integer');
  }
  if (min !== undefined && value < min) {
    return error(errorMessage || `Value must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    return error(errorMessage || `Value must be at most ${max}`);
  }
  return success(value);
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(
  value: unknown,
  errorMessage = 'Must be a positive integer'
): ValidationResult<number> {
  return validateInteger(value, 1, undefined, errorMessage);
}

/**
 * Validate boolean
 */
export function validateBoolean(value: unknown): ValidationResult<boolean> {
  if (!isBoolean(value)) {
    return error(`Expected boolean, got ${typeof value}`);
  }
  return success(value);
}

/**
 * Validate object with optional fields
 */
export function validateObject<T extends Record<string, unknown>>(
  value: unknown,
  validators: {
    [K in keyof T]?: (val: unknown) => ValidationResult<T[K]>;
  },
  allowExtra = false
): ValidationResult<T> {
  if (!isObject(value)) {
    return error(`Expected object, got ${typeof value}`);
  }

  const result = {} as Partial<T>;
  const errors: string[] = [];

  // Validate known fields
  for (const [key, validator] of Object.entries(validators)) {
    if (key in value && validator) {
      const fieldResult = validator(value[key]);
      if (fieldResult.success) {
        // Only include field if it's not undefined (for optional fields)
        if (fieldResult.data !== undefined) {
          result[key as keyof T] = fieldResult.data;
        }
      } else {
        errors.push(`${key}: ${fieldResult.error.message}`);
      }
    }
  }

  // Check for extra fields if not allowed
  if (!allowExtra) {
    for (const key in value) {
      if (!(key in validators)) {
        errors.push(`Unexpected field: ${key}`);
      }
    }
  }

  if (errors.length > 0) {
    return error(errors.join('; '));
  }

  return success(result as T);
}

/**
 * Validate optional value
 */
export function validateOptional<T>(
  value: unknown,
  validator: (val: unknown) => ValidationResult<T>
): ValidationResult<T | undefined> {
  if (value === undefined || value === null) {
    return success(undefined);
  }
  return validator(value);
}

/**
 * Validate union (one of multiple validators)
 */
export function validateUnion<T>(
  value: unknown,
  validators: Array<(val: unknown) => ValidationResult<T>>
): ValidationResult<T> {
  const errors: string[] = [];
  for (const validator of validators) {
    const result = validator(value);
    if (result.success) {
      return result;
    }
    errors.push(result.error.message);
  }
  return error(`None of the validators passed: ${errors.join('; ')}`);
}

/**
 * Validate record (object with string keys)
 */
export function validateRecord<T>(
  value: unknown,
  valueValidator: (val: unknown) => ValidationResult<T>,
  _allowExtra = true
): ValidationResult<Record<string, T>> {
  if (!isObject(value)) {
    return error(`Expected object, got ${typeof value}`);
  }

  const result: Record<string, T> = {};
  const errors: string[] = [];

  for (const [key, val] of Object.entries(value)) {
    const fieldResult = valueValidator(val);
    if (fieldResult.success) {
      result[key] = fieldResult.data;
    } else {
      errors.push(`${key}: ${fieldResult.error.message}`);
    }
  }

  if (errors.length > 0) {
    return error(errors.join('; '));
  }

  return success(result);
}
