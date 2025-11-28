# Examples

Real-world examples for common use cases.

## Basic Validation

### Simple Check

```typescript
import { validate } from '@mailtester/core';

const result = await validate('user@gmail.com');

if (result.valid) {
  console.log('Email is valid!');
  console.log(`Score: ${result.score}/100`);
} else {
  console.log(`Invalid: ${result.reason}`);
}
```

### Check Specific Validators

```typescript
const result = await validate('user@gmaill.com');

// Check typo suggestion
if (result.validators.typo?.details?.suggestion) {
  console.log(`Did you mean: ${result.validators.typo.details.suggestion}?`);
}

// Check if disposable
if (!result.validators.disposable?.valid) {
  console.log('Disposable email not allowed');
}

// Check MX records
if (!result.validators.mx?.valid) {
  console.log('Domain has no mail servers');
}
```

---

## User Registration

### Form Validation

```typescript
import { validate } from '@mailtester/core';

async function validateRegistration(email: string, password: string) {
  // Validate email
  const validation = await validate(email, {
    preset: 'balanced',  // Skip SMTP for speed
    earlyExit: true
  });

  if (!validation.valid) {
    throw new Error(`Invalid email: ${validation.reason}`);
  }

  // Check for typo
  if (validation.validators.typo?.details?.suggestion) {
    return {
      warning: `Did you mean ${validation.validators.typo.details.suggestion}?`,
      proceed: true
    };
  }

  return { proceed: true };
}
```

### Express.js Middleware

```typescript
import express from 'express';
import { validate } from '@mailtester/core';

const app = express();
app.use(express.json());

// Email validation middleware
const validateEmail = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const result = await validate(email, { preset: 'balanced' });

  if (!result.valid) {
    return res.status(400).json({
      error: 'Invalid email',
      reason: result.reason,
      suggestion: result.validators.typo?.details?.suggestion
    });
  }

  req.validatedEmail = result;
  next();
};

// Use in routes
app.post('/api/register', validateEmail, async (req, res) => {
  const { email, password } = req.body;
  // Email is already validated
  // Proceed with registration...
});
```

---

## Bulk Validation

### Email List Cleaning

```typescript
import { validateBulk } from '@mailtester/core';

async function cleanEmailList(emails: string[]) {
  console.log(`Cleaning ${emails.length} emails...`);

  const result = await validateBulk(emails, {
    concurrency: 20,
    config: { preset: 'balanced' },
    onProgress: (completed, total) => {
      const percent = Math.round((completed / total) * 100);
      process.stdout.write(`\rProgress: ${percent}%`);
    }
  });

  console.log('\n');
  console.log(`Total: ${result.total}`);
  console.log(`Valid: ${result.valid}`);
  console.log(`Invalid: ${result.invalid}`);
  console.log(`Duration: ${result.duration}ms`);

  // Get valid emails
  const validEmails = result.results
    .filter(r => r.valid)
    .map(r => r.email);

  return validEmails;
}

// Usage
const emails = [
  'user1@gmail.com',
  'user2@yahoo.com',
  'fake@mailinator.com',
  'invalid-email',
  'user3@outlook.com'
];

const cleaned = await cleanEmailList(emails);
console.log('Valid emails:', cleaned);
```

### With Rate Limiting

```typescript
import { validateBulk } from '@mailtester/core';

const result = await validateBulk(emails, {
  concurrency: 10,
  rateLimit: {
    global: {
      requests: 100,
      window: 60  // 100 requests per minute
    },
    perDomain: {
      requests: 5,
      window: 60  // 5 per domain per minute
    }
  }
});
```

---

## Custom Validator Instance

### Reusable Configuration

```typescript
import { createValidator } from '@mailtester/core';

// Create validator once
const emailValidator = createValidator({
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }  // Disable for speed
  },
  earlyExit: true
});

// Use multiple times
async function validateEmails(emails: string[]) {
  const results = [];

  for (const email of emails) {
    const result = await emailValidator.validate(email);
    results.push(result);
  }

  return results;
}
```

---

## Error Handling

### Graceful Error Handling

```typescript
import { validate, ValidationError } from '@mailtester/core';

async function safeValidate(email: string) {
  try {
    const result = await validate(email);
    return { success: true, result };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      };
    }

    // Unexpected error
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred'
      }
    };
  }
}
```

### Timeout Handling

```typescript
import { validate } from '@mailtester/core';

const result = await validate('user@example.com', {
  timeout: 5000  // 5 second timeout
});
```

---

## API Endpoint

### REST API with Express

```typescript
import express from 'express';
import { validate, validateBulk } from '@mailtester/core';

const app = express();
app.use(express.json());

// Single email validation
app.post('/api/validate', async (req, res) => {
  const { email, options } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const result = await validate(email, options);

  res.json({
    valid: result.valid,
    score: result.score,
    reason: result.reason,
    validators: result.validators
  });
});

// Bulk validation
app.post('/api/validate/bulk', async (req, res) => {
  const { emails, options } = req.body;

  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'Emails array is required' });
  }

  const result = await validateBulk(emails, {
    concurrency: 10,
    config: options,
    ...options
  });

  res.json({
    total: result.total,
    valid: result.valid,
    invalid: result.invalid,
    duration: result.duration,
    results: result.results
  });
});

app.listen(3000, () => {
  console.log('Email validation API running on port 3000');
});
```

---

## TypeScript Usage

### Full Type Safety

```typescript
import type {
  ValidationResult,
  ValidatorResult,
  Config,
  BulkValidationOptions,
  BulkValidationResult
} from '@mailtester/core';

import { validate, validateBulk, createValidator } from '@mailtester/core';

// Typed configuration
const config: Config = {
  preset: 'strict',
  earlyExit: true
};

// Typed result
const result: ValidationResult = await validate('user@example.com', config);

// Typed bulk options
const bulkOptions: BulkValidationOptions = {
  concurrency: 10,
  continueOnError: true,
  onProgress: (completed: number, total: number) => {
    console.log(`${completed}/${total}`);
  }
};

// Typed bulk result
const bulkResult: BulkValidationResult = await validateBulk(
  ['user1@gmail.com', 'user2@yahoo.com'],
  bulkOptions
);
```

---

## Performance Tips

### Fast Validation (No Network)

```typescript
// Use permissive preset for instant validation
const result = await validate('user@example.com', {
  preset: 'permissive'  // Regex only
});
```

### Balanced Speed/Coverage

```typescript
// Use balanced preset (no SMTP)
const result = await validate('user@example.com', {
  preset: 'balanced'
});
```

### Optimize Bulk Processing

```typescript
// Higher concurrency for faster processing
const result = await validateBulk(emails, {
  concurrency: 50,  // Increase from default 10
  config: { preset: 'balanced' }  // Skip SMTP
});
```

