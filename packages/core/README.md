<div align="center">

# @mailtester/core

**Modern, high-performance email validation for Node.js**

[![npm version](https://img.shields.io/npm/v/@mailtester/core.svg?style=flat-square)](https://www.npmjs.com/package/@mailtester/core)
[![npm downloads](https://img.shields.io/npm/dm/@mailtester/core.svg?style=flat-square)](https://www.npmjs.com/package/@mailtester/core)
[![Build Status](https://img.shields.io/github/actions/workflow/status/kazmiali/mailtester/ci.yml?branch=main&style=flat-square)](https://github.com/kazmiali/mailtester/actions)
[![Coverage](https://img.shields.io/codecov/c/github/kazmiali/mailtester?style=flat-square)](https://codecov.io/gh/kazmiali/mailtester)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A comprehensive email validation library with RFC 5322 compliance, typo detection, disposable email blocking, MX record verification, and SMTP validation.

**[📚 Documentation](https://kazmiali.github.io/mailtester/)** •
[Installation](#installation) •
[Quick Start](#quick-start) •
[API Reference](#api-reference) •
[Configuration](#configuration) •
[License](#license)

</div>

---

## Features

- **RFC 5322 Compliant** — Full regex validation with strict and loose modes
- **Typo Detection** — Suggests corrections for common domain typos (gmaill.com → gmail.com)
- **Disposable Email Blocking** — Detects 40,000+ temporary email services
- **MX Record Validation** — Verifies domain has valid mail servers
- **SMTP Verification** — Checks if mailbox actually exists
- **Bulk Validation** — Process thousands of emails concurrently
- **Rate Limiting** — Built-in protection against API abuse
- **TypeScript First** — Full type safety with strict mode
- **Zero Config** — Sensible defaults, works out of the box
- **Lightweight** — ~25KB gzipped, minimal dependencies

## Requirements

- Node.js 20.0.0 or higher
- TypeScript 5.3+ (for TypeScript users)

## Installation

```bash
# npm
npm install @mailtester/core

# yarn
yarn add @mailtester/core

# pnpm
pnpm add @mailtester/core
```

## Quick Start

### Basic Validation

```typescript
import { validate } from '@mailtester/core';

const result = await validate('user@example.com');

console.log(result.valid);  // true
console.log(result.score);  // 85 (0-100 reputation score)
```

### With Configuration

```typescript
import { validate } from '@mailtester/core';

const result = await validate('user@example.com', {
  preset: 'balanced',  // Skip SMTP for faster validation
  earlyExit: true      // Stop on first failure
});

if (!result.valid) {
  console.log(`Invalid: ${result.reason}`);
  // e.g., "Invalid: disposable"
}
```

### Bulk Validation

```typescript
import { validateBulk } from '@mailtester/core';

const emails = [
  'user1@gmail.com',
  'user2@yahoo.com',
  'fake@mailinator.com'
];

const result = await validateBulk(emails, {
  concurrency: 10,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
});

console.log(`Valid: ${result.valid}/${result.total}`);
// Valid: 2/3
```

### Custom Validator Instance

```typescript
import { createValidator } from '@mailtester/core';

// Create a reusable validator with custom config
const validator = createValidator({
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }  // Disable SMTP for speed
  },
  earlyExit: true
});

// Validate multiple emails with same config
const result1 = await validator.validate('user@gmail.com');
const result2 = await validator.validate('test@example.com');
```

## API Reference

### `validate(email, options?)`

Validates a single email address.

```typescript
const result = await validate('user@example.com');
```

**Parameters:**
- `email` (string) — Email address to validate
- `options` (Config, optional) — Validation configuration

**Returns:** `Promise<ValidationResult>`

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

### `validateBulk(emails, options?)`

Validates multiple email addresses concurrently.

```typescript
const result = await validateBulk(emails, {
  concurrency: 10,
  onProgress: (completed, total) => console.log(`${completed}/${total}`)
});
```

**Parameters:**
- `emails` (string[]) — Array of email addresses
- `options` (BulkValidationOptions, optional) — Bulk validation options

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | number | 10 | Max concurrent validations |
| `continueOnError` | boolean | true | Continue if individual validation fails |
| `onProgress` | function | — | Progress callback `(completed, total) => void` |
| `config` | Config | — | Validation config for all emails |
| `rateLimit` | object | — | Rate limiting configuration |

**Returns:** `Promise<BulkValidationResult>`

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

### `createValidator(config?)`

Creates a reusable validator instance with custom configuration.

```typescript
const validator = createValidator({ preset: 'strict' });
const result = await validator.validate('user@example.com');
```

**Parameters:**
- `config` (Config, optional) — Validator configuration

**Returns:** `ValidatorInstance`

```typescript
interface ValidatorInstance {
  validate(email: string): Promise<ValidationResult>;
  getConfig(): MergedConfig;
}
```

## Configuration

### Presets

Three built-in presets for common use cases:

| Preset | Validators | Early Exit | Use Case |
|--------|------------|------------|----------|
| `strict` | All enabled | Yes | Maximum validation (default) |
| `balanced` | SMTP disabled | No | Fast validation with good coverage |
| `permissive` | Regex only | Yes | Quick format check |

```typescript
// Use strict preset (default)
await validate('user@example.com', { preset: 'strict' });

// Use balanced preset (no SMTP)
await validate('user@example.com', { preset: 'balanced' });

// Use permissive preset (regex only)
await validate('user@example.com', { preset: 'permissive' });
```

### Custom Configuration

```typescript
await validate('user@example.com', {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }
  },
  earlyExit: true,   // Stop on first failure
  timeout: 30000     // 30 second timeout
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | string | — | Use preset config: `'strict'`, `'balanced'`, `'permissive'` |
| `validators` | object | — | Enable/disable individual validators |
| `earlyExit` | boolean | true | Stop validation on first failure |
| `timeout` | number | — | Overall timeout in milliseconds |

## Validators

### Regex Validator

Validates email format according to RFC 5322 standards.

```typescript
// Enabled by default
{ regex: { enabled: true } }
```

**Checks:**
- Valid email format (local@domain)
- Proper character usage
- Domain structure
- Internationalized domain names (IDN)

### Typo Validator

Detects common domain typos and suggests corrections.

```typescript
// Enabled by default
{ typo: { enabled: true } }
```

**Examples:**
- `gmaill.com` → suggests `gmail.com`
- `yahooo.com` → suggests `yahoo.com`
- `hotmal.com` → suggests `hotmail.com`

### Disposable Validator

Blocks temporary/disposable email services.

```typescript
// Enabled by default
{ disposable: { enabled: true } }
```

**Blocks:**
- 40,000+ known disposable domains
- Pattern-based detection
- Temporary email services

### MX Validator

Verifies domain has valid mail exchange servers.

```typescript
// Enabled by default
{ mx: { enabled: true } }
```

**Checks:**
- MX records exist
- DNS resolution works
- Fallback to A records

### SMTP Validator

Verifies mailbox exists by connecting to mail server.

```typescript
// Enabled by default (disable for speed)
{ smtp: { enabled: true } }
```

**Checks:**
- SMTP connection
- RCPT TO verification
- Mailbox existence

> **Note:** SMTP validation may be blocked by some mail servers or firewalls. Consider using `balanced` preset if you experience timeouts.

## Rate Limiting

Built-in rate limiting for bulk validation:

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

## Error Handling

```typescript
import { validate, ValidationError } from '@mailtester/core';

try {
  const result = await validate('user@example.com');
  
  if (!result.valid) {
    console.log(`Invalid email: ${result.reason}`);
    
    // Check specific validator errors
    if (result.validators.disposable?.error) {
      console.log('Disposable email detected');
    }
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Validation error: ${error.code}`);
  }
}
```

## TypeScript Support

Full TypeScript support with strict mode:

```typescript
import type {
  ValidationResult,
  ValidatorResult,
  Config,
  BulkValidationOptions,
  BulkValidationResult
} from '@mailtester/core';

// All types are exported
const config: Config = {
  preset: 'strict',
  earlyExit: true
};

const result: ValidationResult = await validate('user@example.com', config);
```

## Performance

- **Single validation:** < 150ms (without SMTP)
- **Bulk 100 emails:** < 5 seconds
- **Package size:** ~25KB gzipped

### Tips for Better Performance

1. **Disable SMTP** for faster validation:
   ```typescript
   await validate(email, { preset: 'balanced' });
   ```

2. **Use bulk validation** for multiple emails:
   ```typescript
   await validateBulk(emails, { concurrency: 20 });
   ```

3. **Enable early exit** to stop on first failure:
   ```typescript
   await validate(email, { earlyExit: true });
   ```

## Examples

### Express.js Integration

```typescript
import express from 'express';
import { validate } from '@mailtester/core';

const app = express();
app.use(express.json());

app.post('/api/validate-email', async (req, res) => {
  const { email } = req.body;
  
  const result = await validate(email, { preset: 'balanced' });
  
  res.json({
    valid: result.valid,
    score: result.score,
    reason: result.reason
  });
});
```

### User Registration

```typescript
import { validate } from '@mailtester/core';

async function registerUser(email: string, password: string) {
  // Validate email first
  const validation = await validate(email, {
    validators: {
      regex: { enabled: true },
      typo: { enabled: true },
      disposable: { enabled: true },
      mx: { enabled: true },
      smtp: { enabled: false }  // Skip for speed
    }
  });
  
  if (!validation.valid) {
    throw new Error(`Invalid email: ${validation.reason}`);
  }
  
  // Check for typo suggestions
  if (validation.validators.typo?.details?.suggestion) {
    // Optionally warn user about potential typo
    console.log(`Did you mean: ${validation.validators.typo.details.suggestion}?`);
  }
  
  // Proceed with registration...
}
```

### Email List Cleaning

```typescript
import { validateBulk } from '@mailtester/core';

async function cleanEmailList(emails: string[]) {
  const result = await validateBulk(emails, {
    concurrency: 20,
    config: { preset: 'balanced' },
    onProgress: (completed, total) => {
      const percent = Math.round((completed / total) * 100);
      console.log(`Cleaning: ${percent}%`);
    }
  });
  
  const validEmails = result.results
    .filter(r => r.valid)
    .map(r => r.email);
  
  console.log(`Cleaned: ${validEmails.length}/${emails.length} valid`);
  
  return validEmails;
}
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/kazmiali/mailtester.git

# Install dependencies
yarn install

# Run tests
yarn test

# Build
yarn build
```

## License

MIT © [Ali Kazmi](https://github.com/kazmiali)

---

<div align="center">

**[Report Bug](https://github.com/kazmiali/mailtester/issues)** •
**[Request Feature](https://github.com/kazmiali/mailtester/issues)** •
**[Star on GitHub](https://github.com/kazmiali/mailtester)**

</div>

