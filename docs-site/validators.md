# Validators

@mailtester/core includes 5 validators that work together to comprehensively validate email addresses.

## Overview

| Validator | Purpose | Speed | Network |
|-----------|---------|-------|---------|
| **Regex** | Format validation | ⚡ Instant | No |
| **Typo** | Detect typos | ⚡ Instant | No |
| **Disposable** | Block temp emails | ⚡ Instant | No |
| **MX** | Verify mail servers | 🔄 ~50ms | Yes |
| **SMTP** | Verify mailbox | 🔄 ~100ms | Yes |

## Regex Validator

Validates email format according to RFC 5322 standards.

### What it Checks

- ✅ Valid email format (local@domain)
- ✅ Proper character usage
- ✅ Domain structure
- ✅ Internationalized domain names (IDN)

### Configuration

```typescript
await validate('user@example.com', {
  validators: {
    regex: { enabled: true }  // Default: true
  }
});
```

### Examples

| Email | Result | Reason |
|-------|--------|--------|
| `user@example.com` | ✅ Valid | Standard format |
| `user+tag@example.com` | ✅ Valid | Plus addressing |
| `user.name@example.com` | ✅ Valid | Dots in local |
| `user@名がドメイン.com` | ✅ Valid | IDN support |
| `invalid` | ❌ Invalid | Missing @ symbol |
| `@example.com` | ❌ Invalid | Missing local part |
| `user@` | ❌ Invalid | Missing domain |

---

## Typo Validator

Detects common domain typos and suggests corrections.

### What it Checks

- ✅ Common domain misspellings
- ✅ TLD typos
- ✅ Keyboard proximity errors

### Configuration

```typescript
await validate('user@gmaill.com', {
  validators: {
    typo: { enabled: true }  // Default: true
  }
});
```

### Examples

| Input | Suggestion |
|-------|------------|
| `user@gmaill.com` | `gmail.com` |
| `user@yahooo.com` | `yahoo.com` |
| `user@hotmal.com` | `hotmail.com` |
| `user@outlok.com` | `outlook.com` |
| `user@gogle.com` | `google.com` |

### Accessing Suggestions

```typescript
const result = await validate('user@gmaill.com');

if (result.validators.typo?.details?.suggestion) {
  console.log(`Did you mean: ${result.validators.typo.details.suggestion}?`);
  // Output: "Did you mean: gmail.com?"
}
```

---

## Disposable Validator

Blocks temporary/disposable email services.

### What it Checks

- ✅ 40,000+ known disposable domains
- ✅ Pattern-based detection
- ✅ Temporary email services

### Configuration

```typescript
await validate('user@mailinator.com', {
  validators: {
    disposable: { enabled: true }  // Default: true
  }
});
```

### Blocked Services (Examples)

- mailinator.com
- guerrillamail.com
- 10minutemail.com
- tempmail.com
- throwaway.email
- And 40,000+ more...

### Example

```typescript
const result = await validate('test@mailinator.com');

console.log(result.valid);   // false
console.log(result.reason);  // "disposable"
```

---

## MX Validator

Verifies domain has valid mail exchange (MX) servers.

### What it Checks

- ✅ MX records exist
- ✅ DNS resolution works
- ✅ Fallback to A records if no MX

### Configuration

```typescript
await validate('user@example.com', {
  validators: {
    mx: { enabled: true }  // Default: true
  }
});
```

### How it Works

1. Queries DNS for MX records
2. If no MX found, checks for A records (fallback)
3. Validates at least one mail server exists

### Example

```typescript
const result = await validate('user@nonexistent-domain-xyz.com');

if (!result.validators.mx?.valid) {
  console.log('Domain has no mail servers');
}
```

::: tip Performance
MX validation requires DNS lookup (~50ms). For faster validation, use the `balanced` or `permissive` preset.
:::

---

## SMTP Validator

Verifies mailbox exists by connecting to the mail server.

### What it Checks

- ✅ SMTP connection to port 25
- ✅ HELO/EHLO handshake
- ✅ MAIL FROM command
- ✅ RCPT TO verification
- ✅ Mailbox existence

### Configuration

```typescript
await validate('user@example.com', {
  validators: {
    smtp: { enabled: true }  // Default: true
  }
});
```

### How it Works

1. Resolves MX records for domain
2. Connects to mail server on port 25
3. Performs SMTP handshake
4. Sends RCPT TO command to verify mailbox
5. Checks response code

### Example

```typescript
const result = await validate('nonexistent-user@gmail.com');

if (!result.validators.smtp?.valid) {
  console.log('Mailbox does not exist');
}
```

::: warning Limitations
- Some mail servers block SMTP verification
- Corporate firewalls may block port 25
- Gmail and other providers may rate limit

Consider using `balanced` preset if you experience timeouts.
:::

---

## Validation Order

Validators run in this order:

1. **Regex** - Quick format check (stops if invalid)
2. **Typo** - Check for domain typos
3. **Disposable** - Check if disposable
4. **MX** - Verify mail servers exist
5. **SMTP** - Verify mailbox exists

With `earlyExit: true` (default), validation stops at the first failure.

---

## Disabling Validators

Disable validators you don't need:

```typescript
// Fast validation (no network calls)
await validate('user@example.com', {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: false },
    smtp: { enabled: false }
  }
});
```

Or use a preset:

```typescript
// Balanced: No SMTP
await validate('user@example.com', { preset: 'balanced' });

// Permissive: Regex only
await validate('user@example.com', { preset: 'permissive' });
```

