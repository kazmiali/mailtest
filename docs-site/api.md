# API Reference

Complete API documentation for @mailtester/core.

## Functions

### validate()

Validates a single email address.

```typescript
import { validate } from '@mailtester/core';

const result = await validate(email, options?);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | Email address to validate |
| `options` | `Config` | No | Validation configuration |

**Returns:** `Promise<ValidationResult>`

**Example:**

```typescript
// Basic usage
const result = await validate('user@gmail.com');

// With options
const result = await validate('user@gmail.com', {
  preset: 'balanced',
  earlyExit: true
});
```

---

### validateBulk()

Validates multiple email addresses concurrently.

```typescript
import { validateBulk } from '@mailtester/core';

const result = await validateBulk(emails, options?);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `emails` | `string[]` | Yes | Array of email addresses |
| `options` | `BulkValidationOptions` | No | Bulk validation options |

**Bulk Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `10` | Max concurrent validations |
| `continueOnError` | `boolean` | `true` | Continue if individual validation fails |
| `onProgress` | `function` | — | Progress callback `(completed, total) => void` |
| `config` | `Config` | — | Validation config for all emails |
| `rateLimit` | `object` | — | Rate limiting configuration |

**Returns:** `Promise<BulkValidationResult>`

**Example:**

```typescript
const result = await validateBulk(emails, {
  concurrency: 20,
  config: { preset: 'balanced' },
  onProgress: (completed, total) => {
    console.log(`${completed}/${total}`);
  }
});
```

---

### createValidator()

Creates a reusable validator instance with custom configuration.

```typescript
import { createValidator } from '@mailtester/core';

const validator = createValidator(config?);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `Config` | No | Validator configuration |

**Returns:** `ValidatorInstance`

**Example:**

```typescript
// Create once, use many times
const validator = createValidator({
  preset: 'strict',
  earlyExit: true
});

const result1 = await validator.validate('user1@gmail.com');
const result2 = await validator.validate('user2@yahoo.com');
```

---

## Types

### ValidationResult

Result of a single email validation.

```typescript
interface ValidationResult {
  valid: boolean;           // Overall validity
  email: string;            // Email that was validated
  score: number;            // Reputation score (0-100)
  reason?: string;          // Which validator failed (if invalid)
  validators: {             // Individual validator results
    regex?: ValidatorResult;
    typo?: ValidatorResult;
    disposable?: ValidatorResult;
    mx?: ValidatorResult;
    smtp?: ValidatorResult;
  };
  metadata?: {
    timestamp?: string;     // ISO 8601 timestamp
    duration?: number;      // Validation duration in ms
  };
}
```

### ValidatorResult

Result from an individual validator.

```typescript
interface ValidatorResult {
  valid: boolean;           // Validator passed
  error?: {
    code: string;           // Error code
    message: string;        // Error message
  };
  details?: Record<string, unknown>;  // Additional details
}
```

### BulkValidationResult

Result of bulk email validation.

```typescript
interface BulkValidationResult {
  results: ValidationResult[];  // Individual results
  total: number;                // Total emails processed
  valid: number;                // Count of valid emails
  invalid: number;              // Count of invalid emails
  errors: number;               // Count of errors
  duration: number;             // Total duration in ms
}
```

### Config

Validation configuration options.

```typescript
interface Config {
  preset?: 'strict' | 'balanced' | 'permissive';
  validators?: {
    regex?: { enabled: boolean };
    typo?: { enabled: boolean };
    disposable?: { enabled: boolean };
    mx?: { enabled: boolean };
    smtp?: { enabled: boolean };
  };
  earlyExit?: boolean;
  timeout?: number;
}
```

### ValidatorInstance

Reusable validator instance.

```typescript
interface ValidatorInstance {
  validate(email: string): Promise<ValidationResult>;
  getConfig(): MergedConfig;
}
```

---

## Configuration Options

### Presets

| Preset | Validators | Early Exit | Use Case |
|--------|------------|------------|----------|
| `strict` | All enabled | Yes | Maximum validation (default) |
| `balanced` | SMTP disabled | No | Fast with good coverage |
| `permissive` | Regex only | Yes | Quick format check |

### Individual Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | `string` | — | Use preset: `'strict'`, `'balanced'`, `'permissive'` |
| `validators` | `object` | — | Enable/disable individual validators |
| `earlyExit` | `boolean` | `true` | Stop validation on first failure |
| `timeout` | `number` | — | Overall timeout in milliseconds |

---

## Rate Limiting

Configure rate limiting for bulk validation:

```typescript
await validateBulk(emails, {
  rateLimit: {
    global: {
      requests: 100,  // Max requests
      window: 60      // Per 60 seconds
    },
    perDomain: {
      requests: 10,   // Max per domain
      window: 60      // Per 60 seconds
    }
  }
});
```

---

## Error Handling

### ValidationError

```typescript
import { validate, ValidationError } from '@mailtester/core';

try {
  const result = await validate('user@example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Error code: ${error.code}`);
    console.log(`Message: ${error.message}`);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Invalid input provided |
| `INVALID_FORMAT` | Email format is invalid |
| `DISPOSABLE_EMAIL` | Disposable email detected |
| `NO_MX_RECORDS` | Domain has no MX records |
| `SMTP_ERROR` | SMTP verification failed |
| `TIMEOUT` | Operation timed out |
| `NETWORK_ERROR` | Network error occurred |

