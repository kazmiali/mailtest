# Changelog

All notable changes to `@mailtester/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2024-11-27

### Added

#### Validators
- **Regex Validator** - RFC 5322 compliant email format validation
  - Strict mode: Full RFC compliance with quoted strings
  - Loose mode: Practical validation for common formats
  - Support for internationalized domain names (IDN)
  - Detailed error messages for validation failures

- **Typo Validator** - Domain typo detection and suggestions
  - Detects common typos (gmaill.com → gmail.com)
  - 100+ TLD coverage
  - Confidence scoring
  - Custom domain list support

- **Disposable Validator** - Temporary email detection
  - 40,000+ known disposable domains
  - Pattern-based detection (10minutemail, tempmail, etc.)
  - Custom blacklist/whitelist support
  - Lazy loading for performance

- **MX Validator** - Mail server verification
  - DNS MX record lookup
  - Retry logic with exponential backoff
  - Quality scoring (0-20 points)
  - A record fallback

- **SMTP Validator** - Mailbox existence verification
  - SMTP command sequence (HELO → MAIL FROM → RCPT TO)
  - TLS/STARTTLS support
  - Greylisting detection
  - Configurable timeout and retries

#### Bulk Validation
- `validateBulk()` function for processing multiple emails
- Configurable concurrency (default: 10)
- Progress tracking via callbacks
- Continue on error option
- Rate limiting integration

#### Rate Limiting
- Token bucket algorithm
- Per-domain rate limits
- Global rate limits
- Configurable requests per time window

#### Configuration
- Three presets: `strict`, `balanced`, `permissive`
- Per-validator enable/disable
- Early exit on failure option
- Timeout configuration

#### API Functions
- `validate(email, options?)` - Single email validation
- `validateBulk(emails, options?)` - Bulk validation
- `createValidator(config?)` - Reusable validator factory

#### Types & Exports
- Full TypeScript type definitions
- `ValidationResult` interface
- `ValidatorResult` interface
- `BulkValidationResult` interface
- Error classes: `ValidationError`, `ConfigurationError`, `NetworkError`, `TimeoutError`

### Performance
- Single validation: < 150ms (without SMTP)
- Bulk 100 emails: < 5 seconds
- Package size: ~25KB gzipped

### Technical
- Node.js 20+ required
- TypeScript 5.3+ with strict mode
- ESM and CommonJS dual exports
- 90%+ test coverage (644 tests)

[1.0.0-beta.1]: https://github.com/kazmiali/mailtester/releases/tag/v1.0.0-beta.1

