import { describe, it, expect } from 'vitest';
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
  validateUnion,
} from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateEnum', () => {
    it('should validate valid enum value', () => {
      const result = validateEnum('test', ['test', 'other'] as const, 'Invalid');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test');
      }
    });

    it('should reject invalid enum value', () => {
      const result = validateEnum('invalid', ['test', 'other'] as const, 'Invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid');
      }
    });

    it('should reject non-string value', () => {
      const result = validateEnum(123, ['test'] as const, 'Invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected string');
      }
    });
  });

  describe('validateString', () => {
    it('should validate valid string', () => {
      const result = validateString('test');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test');
      }
    });

    it('should validate string meeting minimum length', () => {
      const result = validateString('test', 4);
      expect(result.success).toBe(true);
    });

    it('should reject string below minimum length', () => {
      const result = validateString('abc', 5);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('at least 5');
      }
    });

    it('should reject non-string value', () => {
      const result = validateString(123);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected string');
      }
    });

    it('should use custom error message', () => {
      const result = validateString('ab', 5, 'Custom error');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Custom error');
      }
    });
  });

  describe('validateEmail', () => {
    it('should validate valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should reject invalid email format', () => {
      const result = validateEmail('not-an-email');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid email format');
      }
    });

    it('should reject non-string value', () => {
      const result = validateEmail(123);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected string');
      }
    });

    it('should reject empty string', () => {
      const result = validateEmail('');
      expect(result.success).toBe(false);
    });

    it('should use custom error message', () => {
      const result = validateEmail('invalid', 'Custom email error');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Custom email error');
      }
    });
  });

  describe('validateInteger', () => {
    it('should validate valid integer', () => {
      const result = validateInteger(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should validate integer within range', () => {
      const result = validateInteger(50, 0, 100);
      expect(result.success).toBe(true);
    });

    it('should reject non-number value', () => {
      const result = validateInteger('123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected number');
      }
    });

    it('should reject non-integer number', () => {
      const result = validateInteger(42.5);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected integer');
      }
    });

    it('should reject value below minimum', () => {
      const result = validateInteger(5, 10);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('at least 10');
      }
    });

    it('should reject value above maximum', () => {
      const result = validateInteger(150, 0, 100);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('at most 100');
      }
    });

    it('should use custom error message', () => {
      const result = validateInteger(5, 10, undefined, 'Custom error');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Custom error');
      }
    });
  });

  describe('validatePositiveInteger', () => {
    it('should validate positive integer', () => {
      const result = validatePositiveInteger(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should reject zero', () => {
      const result = validatePositiveInteger(0);
      expect(result.success).toBe(false);
    });

    it('should reject negative number', () => {
      const result = validatePositiveInteger(-5);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer', () => {
      const result = validatePositiveInteger(5.5);
      expect(result.success).toBe(false);
    });

    it('should use custom error message', () => {
      const result = validatePositiveInteger(0, 'Must be positive');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Must be positive');
      }
    });
  });

  describe('validateBoolean', () => {
    it('should validate true', () => {
      const result = validateBoolean(true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });

    it('should validate false', () => {
      const result = validateBoolean(false);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });

    it('should reject non-boolean value', () => {
      const result = validateBoolean('true');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected boolean');
      }
    });
  });

  describe('validateObject', () => {
    it('should validate object with all fields', () => {
      const result = validateObject(
        { name: 'test', age: 30 },
        {
          name: (val) => ({ success: true, data: val as string }),
          age: (val) => ({ success: true, data: val as number }),
        }
      );
      expect(result.success).toBe(true);
    });

    it('should reject non-object value', () => {
      const result = validateObject('not-object', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected object');
      }
    });

    it('should reject array', () => {
      const result = validateObject([1, 2, 3], {});
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = validateObject(null, {});
      expect(result.success).toBe(false);
    });

    it('should validate optional fields', () => {
      const result = validateObject(
        { name: 'test' },
        {
          name: (val) => ({ success: true, data: val as string }),
          age: (val) => ({ success: true, data: val as number }),
        }
      );
      expect(result.success).toBe(true);
    });

    it('should reject invalid field value', () => {
      const result = validateObject(
        { name: 'test', age: 'invalid' },
        {
          name: (val) => ({ success: true, data: val as string }),
          age: (val) => ({ success: false, error: { message: 'Invalid age' } }),
        }
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('age: Invalid age');
      }
    });

    it('should reject extra fields when allowExtra is false', () => {
      const result = validateObject(
        { name: 'test', extra: 'field' },
        {
          name: (val) => ({ success: true, data: val as string }),
        },
        false
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unexpected field: extra');
      }
    });

    it('should allow extra fields when allowExtra is true', () => {
      const result = validateObject(
        { name: 'test', extra: 'field' },
        {
          name: (val) => ({ success: true, data: val as string }),
        },
        true
      );
      expect(result.success).toBe(true);
    });

    it('should handle undefined field values', () => {
      const result = validateObject(
        { name: 'test', age: undefined },
        {
          name: (val) => ({ success: true, data: val as string }),
          age: (val) => ({ success: true, data: val as number }),
        }
      );
      expect(result.success).toBe(true);
    });

    it('should handle multiple validation errors', () => {
      const result = validateObject(
        { name: '', age: -5 },
        {
          name: (val) => ({ success: false, error: { message: 'Name required' } }),
          age: (val) => ({ success: false, error: { message: 'Age must be positive' } }),
        }
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Name required');
        expect(result.error.message).toContain('Age must be positive');
      }
    });
  });

  describe('validateOptional', () => {
    it('should return undefined for undefined value', () => {
      const result = validateOptional(undefined, (val) => ({ success: true, data: val as string }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should return undefined for null value', () => {
      const result = validateOptional(null, (val) => ({ success: true, data: val as string }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should validate value when provided', () => {
      const result = validateOptional('test', (val) => ({ success: true, data: val as string }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test');
      }
    });

    it('should propagate validation error', () => {
      const result = validateOptional('invalid', (val) => ({
        success: false,
        error: { message: 'Invalid value' },
      }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid value');
      }
    });
  });

  describe('validateRecord', () => {
    it('should validate record with valid values', () => {
      const result = validateRecord(
        { key1: 'value1', key2: 'value2' },
        (val) => ({ success: true, data: val as string })
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key1).toBe('value1');
        expect(result.data.key2).toBe('value2');
      }
    });

    it('should reject non-object value', () => {
      const result = validateRecord('not-object', (val) => ({ success: true, data: val as string }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Expected object');
      }
    });

    it('should reject array', () => {
      const result = validateRecord([1, 2], (val) => ({ success: true, data: val as number }));
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = validateRecord(null, (val) => ({ success: true, data: val as string }));
      expect(result.success).toBe(false);
    });

    it('should reject record with invalid values', () => {
      const result = validateRecord(
        { key1: 'valid', key2: 'invalid' },
        (val) => {
          if (val === 'invalid') {
            return { success: false, error: { message: 'Invalid value' } };
          }
          return { success: true, data: val as string };
        }
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('key2: Invalid value');
      }
    });

    it('should handle multiple validation errors', () => {
      const result = validateRecord(
        { key1: 'invalid1', key2: 'invalid2' },
        (val) => ({ success: false, error: { message: `Invalid: ${val}` } })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('key1: Invalid: invalid1');
        expect(result.error.message).toContain('key2: Invalid: invalid2');
      }
    });
  });

  describe('validateUnion', () => {
    it('should validate value matching first validator', () => {
      const result = validateUnion(
        'test',
        [
          (val) => ({ success: true, data: val as string }),
          (val) => ({ success: false, error: { message: 'Error' } }),
        ]
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test');
      }
    });

    it('should validate value matching second validator', () => {
      const result = validateUnion(
        42,
        [
          (val) => ({ success: false, error: { message: 'Not string' } }),
          (val) => ({ success: true, data: val as number }),
        ]
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should reject value matching none of the validators', () => {
      const result = validateUnion(
        'invalid',
        [
          (val) => ({ success: false, error: { message: 'Error 1' } }),
          (val) => ({ success: false, error: { message: 'Error 2' } }),
        ]
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('None of the validators passed');
        expect(result.error.message).toContain('Error 1');
        expect(result.error.message).toContain('Error 2');
      }
    });
  });
});

