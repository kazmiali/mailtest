# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2024-11-27

### Added

#### Core Validation
- **RFC 5322 Compliant Regex Validator** - Full email format validation with strict and loose modes
- **Typo Detection** - Suggests corrections for common domain typos (e.g., gmaill.com → gmail.com)
- **Disposable Email Blocking** - Detects 40,000+ temporary email services with pattern-based detection
- **MX Record Validation** - Verifies domain has valid mail servers with retry logic and quality scoring
- **SMTP Verification** - Checks if mailbox actually exists with greylisting detection

#### Bulk Validation
- **Concurrent Processing** - Validate thousands of emails with configurable concurrency limits
- **Progress Tracking** - Real-time progress callbacks for bulk operations
- **Rate Limiting** - Built-in token bucket algorithm with per-domain and global limits
- **Error Handling** - Continue on error option for resilient batch processing

#### Configuration
- **Preset Configurations** - Three built-in presets: `strict`, `balanced`, `permissive`
- **Flexible Configuration** - Enable/disable individual validators, set timeouts, early exit options
- **TypeScript First** - Full type safety with strict mode and comprehensive type definitions

#### API
- `validate(email, options?)` - Simple single email validation
- `validateBulk(emails, options?)` - Bulk email validation with concurrency control
- `createValidator(config?)` - Create reusable validator instances with custom configuration

#### Performance
- **3x Faster** - Optimized validation pipeline
- **Lazy Loading** - Disposable domain dataset loaded on-demand
- **Lightweight** - ~25KB gzipped package size

### Technical Details

- **Node.js 20+** required
- **TypeScript 5.3+** with strict mode
- **Dual Module Support** - ESM and CommonJS exports
- **90%+ Test Coverage** - 644 tests covering all functionality
- **Zero Config** - Sensible defaults, works out of the box

### Dependencies

- `disposable-email-domains` - Disposable email domain dataset
- `mailcheck` - Typo detection algorithm

---

## Future Releases

### Planned for v1.1.0
- Enhanced reputation scoring with configurable weights
- In-memory LRU caching for improved performance
- Domain reputation database
- MX quality scoring enhancements

### Planned for v1.2.0
- Plugin system for third-party integrations
- Browser-compatible build
- Custom validator plugins

[1.0.0-beta.1]: https://github.com/kazmiali/mailtester/releases/tag/v1.0.0-beta.1

