/**
 * Custom schemas for runtime validation
 * Replaces Zod with lightweight, dependency-free validators
 *
 * @packageDocumentation
 */

import {
  ErrorCode,
  type ErrorSeverity,
  type ValidationError,
  type ValidatorResult,
  type ValidatorConfig,
} from './types';
import {
  validateEnum,
  validateString,
  validateEmail,
  validateInteger,
  validatePositiveInteger,
  validateBoolean,
  validateObject,
  validateOptional,
  validateRecord,
  type ValidationResult,
} from './utils/validation';

/**
 * Schema-like object with safeParse method matching Zod API
 */
class Schema<T> {
  constructor(private validator: (value: unknown) => ValidationResult<T>) {}

  safeParse(value: unknown): ValidationResult<T> {
    return this.validator(value);
  }
}

/**
 * Schema for error severity levels
 */
export const errorSeveritySchema = new Schema<ErrorSeverity>((value) =>
  validateEnum(value, ['warning', 'error', 'critical'] as const, 'Invalid error severity')
);

/**
 * Schema for error codes
 */
export const errorCodeSchema = new Schema<ErrorCode | string>((value) => {
  if (typeof value === 'string') {
    // Check if it's a valid ErrorCode enum value
    const errorCodes = Object.values(ErrorCode) as string[];
    if (errorCodes.includes(value)) {
      return { success: true, data: value as ErrorCode };
    }
    // Allow custom string error codes
    return { success: true, data: value };
  }
  return { success: false, error: { message: 'Expected string or ErrorCode enum' } };
});

/**
 * Schema for validation error details
 */
export const validationErrorSchema = new Schema<ValidationError>((value) => {
  const result = validateObject(
    value,
    {
      code: (val) => errorCodeSchema.safeParse(val),
      message: (val) => validateString(val, 1, 'Error message cannot be empty'),
      suggestion: (val) => validateOptional(val, validateString),
      severity: (val) => errorSeveritySchema.safeParse(val),
      validator: (val) => validateOptional(val, validateString),
      details: () => ({ success: true, data: undefined as unknown }),
    },
    true // Allow extra fields
  );
  return result as ValidationResult<ValidationError>;
});

/**
 * Schema for validator result
 */
export const validatorResultSchema = new Schema<ValidatorResult>((value) => {
  const result = validateObject(
    value,
    {
      valid: (val) => validateBoolean(val),
      validator: (val) => validateString(val, 1, 'Validator name cannot be empty'),
      error: (val) => validateOptional(val, (v) => validationErrorSchema.safeParse(v)),
      details: (val) =>
        validateOptional(val, (v) => validateRecord(v, () => ({ success: true, data: v }))),
    },
    true
  );
  return result as ValidationResult<ValidatorResult>;
});

/**
 * Schema for validator configuration
 */
export const validatorConfigSchema = new Schema<ValidatorConfig>((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: { message: 'Expected object' } };
  }
  const obj = value as Record<string, unknown>;
  if (!('enabled' in obj)) {
    return { success: false, error: { message: 'Missing required field: enabled' } };
  }
  const enabledResult = validateBoolean(obj.enabled);
  if (!enabledResult.success) {
    return enabledResult;
  }
  return { success: true, data: { enabled: enabledResult.data } };
});

/**
 * Schema for validator options (validators can be boolean or config object)
 */
const validatorOptionsConfigSchema = new Schema<
  Record<string, ValidatorConfig | boolean | undefined>
>((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: { message: 'Expected object' } };
  }

  const result: Record<string, ValidatorConfig | boolean | undefined> = {};
  const errors: string[] = [];

  for (const [key, val] of Object.entries(value)) {
    if (val === undefined) {
      result[key] = undefined;
    } else if (typeof val === 'boolean') {
      result[key] = val;
    } else {
      const configResult = validatorConfigSchema.safeParse(val);
      if (configResult.success) {
        result[key] = configResult.data;
      } else {
        errors.push(`${key}: ${configResult.error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, error: { message: errors.join('; ') } };
  }

  return { success: true, data: result };
});

/**
 * Schema for validator options (single email validation)
 */
export const validatorOptionsSchema = new Schema<{
  email: string;
  validators?: Record<string, ValidatorConfig | boolean | undefined>;
  earlyExit?: boolean;
  timeout?: number;
}>((value) => {
  const result = validateObject(
    value,
    {
      email: (val) => validateEmail(val, 'Invalid email format'),
      validators: (val) => validateOptional(val, (v) => validatorOptionsConfigSchema.safeParse(v)),
      earlyExit: (val) => validateOptional(val, validateBoolean),
      timeout: (val) =>
        validateOptional(val, (v) =>
          validatePositiveInteger(v, 'Timeout must be a positive integer')
        ),
    },
    true
  );
  return result as ValidationResult<{
    email: string;
    validators?: Record<string, ValidatorConfig | boolean | undefined>;
    earlyExit?: boolean;
    timeout?: number;
  }>;
});

/**
 * Schema for validation result reason
 */
const validationReasonSchema = new Schema<
  'regex' | 'typo' | 'disposable' | 'mx' | 'smtp' | 'custom'
>((value) =>
  validateEnum(
    value,
    ['regex', 'typo', 'disposable', 'mx', 'smtp', 'custom'] as const,
    'Invalid reason'
  )
);

/**
 * Schema for validation result validators object
 */
const validatorsResultSchema = new Schema<Record<string, ValidatorResult | undefined>>((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: { message: 'Expected object' } };
  }

  const result: Record<string, ValidatorResult | undefined> = {};
  const errors: string[] = [];

  for (const [key, val] of Object.entries(value)) {
    if (val === undefined) {
      result[key] = undefined;
    } else {
      const validatorResult = validatorResultSchema.safeParse(val);
      if (validatorResult.success) {
        result[key] = validatorResult.data;
      } else {
        errors.push(`${key}: ${validatorResult.error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, error: { message: errors.join('; ') } };
  }

  return { success: true, data: result };
});

/**
 * Schema for validation result (output format)
 */
export const validationResultSchema = new Schema<{
  valid: boolean;
  email: string;
  score: number;
  reason?: 'regex' | 'typo' | 'disposable' | 'mx' | 'smtp' | 'custom';
  validators: Record<string, ValidatorResult | undefined>;
}>((value) => {
  const result = validateObject(
    value,
    {
      valid: (val) => validateBoolean(val),
      email: (val) => validateEmail(val, 'Invalid email format'),
      score: (val) => {
        const result = validateInteger(val, 0, 100, 'Score must be between 0 and 100');
        return result;
      },
      reason: (val) => validateOptional(val, (v) => validationReasonSchema.safeParse(v)),
      validators: (val) => validatorsResultSchema.safeParse(val),
    },
    true
  );
  return result as ValidationResult<{
    valid: boolean;
    email: string;
    score: number;
    reason?: 'regex' | 'typo' | 'disposable' | 'mx' | 'smtp' | 'custom';
    validators: Record<string, ValidatorResult | undefined>;
  }>;
});

/**
 * Schema for configuration preset
 */
export const presetSchema = new Schema<'strict' | 'balanced' | 'permissive'>((value) =>
  validateEnum(value, ['strict', 'balanced', 'permissive'] as const, 'Invalid preset')
);

/**
 * Schema for full configuration
 */
export const configSchema = new Schema<{
  preset?: 'strict' | 'balanced' | 'permissive';
  validators?: Record<string, ValidatorConfig | boolean | undefined>;
  earlyExit?: boolean;
  timeout?: number;
}>((value) => {
  const result = validateObject(
    value,
    {
      preset: (val) => validateOptional(val, (v) => presetSchema.safeParse(v)),
      validators: (val) => validateOptional(val, (v) => validatorOptionsConfigSchema.safeParse(v)),
      earlyExit: (val) => validateOptional(val, validateBoolean),
      timeout: (val) =>
        validateOptional(val, (v) =>
          validatePositiveInteger(v, 'Timeout must be a positive integer')
        ),
    },
    true
  );
  return result as ValidationResult<{
    preset?: 'strict' | 'balanced' | 'permissive';
    validators?: Record<string, ValidatorConfig | boolean | undefined>;
    earlyExit?: boolean;
    timeout?: number;
  }>;
});
