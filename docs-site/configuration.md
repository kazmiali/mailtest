# Configuration

Customize validation behavior with presets or fine-grained options.

## Presets

Use presets for common validation scenarios:

### Strict (Default)

All validators enabled, stops on first failure. Best for maximum validation.

```typescript
await validate('user@example.com', { preset: 'strict' });
```

**What it enables:**
- ✅ Regex validation
- ✅ Typo detection
- ✅ Disposable check
- ✅ MX validation
- ✅ SMTP validation
- ✅ Early exit on failure

**Best for:** User registration, important signups

---

### Balanced

SMTP disabled for faster validation. Good balance of speed and coverage.

```typescript
await validate('user@example.com', { preset: 'balanced' });
```

**What it enables:**
- ✅ Regex validation
- ✅ Typo detection
- ✅ Disposable check
- ✅ MX validation
- ❌ SMTP validation (disabled)
- ❌ Early exit (runs all validators)

**Best for:** General validation, forms, bulk processing

---

### Permissive

Only regex validation. Quick format check.

```typescript
await validate('user@example.com', { preset: 'permissive' });
```

**What it enables:**
- ✅ Regex validation
- ❌ Typo detection
- ❌ Disposable check
- ❌ MX validation
- ❌ SMTP validation
- ✅ Early exit on failure

**Best for:** Quick format checks, client-side validation

---

## Custom Configuration

Fine-tune validation by enabling/disabling specific validators:

```typescript
await validate('user@example.com', {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }
  },
  earlyExit: true,
  timeout: 30000
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | `string` | — | Use preset: `'strict'`, `'balanced'`, `'permissive'` |
| `validators` | `object` | — | Enable/disable individual validators |
| `earlyExit` | `boolean` | `true` | Stop validation on first failure |
| `timeout` | `number` | — | Overall timeout in milliseconds |

## Validator Options

### regex

```typescript
validators: {
  regex: { enabled: true }  // Default: true
}
```

### typo

```typescript
validators: {
  typo: { enabled: true }  // Default: true
}
```

### disposable

```typescript
validators: {
  disposable: { enabled: true }  // Default: true
}
```

### mx

```typescript
validators: {
  mx: { enabled: true }  // Default: true
}
```

### smtp

```typescript
validators: {
  smtp: { enabled: true }  // Default: true (strict), false (balanced)
}
```

---

## Bulk Validation Options

Additional options for `validateBulk()`:

```typescript
await validateBulk(emails, {
  // Concurrency
  concurrency: 10,  // Max concurrent validations (default: 10)

  // Error handling
  continueOnError: true,  // Continue if individual validation fails (default: true)

  // Progress tracking
  onProgress: (completed, total) => {
    console.log(`${completed}/${total}`);
  },

  // Validation config (applied to all emails)
  config: {
    preset: 'balanced'
  },

  // Rate limiting
  rateLimit: {
    global: {
      requests: 100,  // Max requests per window
      window: 60      // Window in seconds
    },
    perDomain: {
      requests: 10,   // Max per domain per window
      window: 60
    }
  }
});
```

## Rate Limiting

Prevent overwhelming mail servers with built-in rate limiting:

### Global Rate Limit

Limits total requests across all domains:

```typescript
rateLimit: {
  global: {
    requests: 100,  // Max 100 requests
    window: 60      // Per 60 seconds
  }
}
```

### Per-Domain Rate Limit

Limits requests to each domain:

```typescript
rateLimit: {
  perDomain: {
    requests: 5,    // Max 5 requests per domain
    window: 60      // Per 60 seconds
  }
}
```

### Combined

```typescript
rateLimit: {
  global: { requests: 100, window: 60 },
  perDomain: { requests: 5, window: 60 }
}
```

---

## Configuration Precedence

When using both preset and custom options, custom options override preset:

```typescript
await validate('user@example.com', {
  preset: 'balanced',  // SMTP disabled by default
  validators: {
    smtp: { enabled: true }  // Override: enable SMTP
  }
});
```

---

## Reusable Configuration

Create a validator instance with preset configuration:

```typescript
import { createValidator } from '@mailtester/core';

const validator = createValidator({
  preset: 'balanced',
  earlyExit: true
});

// Use multiple times with same config
const result1 = await validator.validate('user1@gmail.com');
const result2 = await validator.validate('user2@yahoo.com');

// Get current config
const config = validator.getConfig();
```

---

## TypeScript Types

```typescript
import type { Config, BulkValidationOptions } from '@mailtester/core';

const config: Config = {
  preset: 'strict',
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }
  },
  earlyExit: true,
  timeout: 30000
};

const bulkOptions: BulkValidationOptions = {
  concurrency: 20,
  continueOnError: true,
  config: { preset: 'balanced' },
  rateLimit: {
    global: { requests: 100, window: 60 }
  }
};
```

