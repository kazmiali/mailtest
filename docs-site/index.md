---
layout: home

hero:
  name: "@mailtester/core"
  text: "Email Validation Done Right"
  tagline: Modern, high-performance email validation for Node.js with RFC 5322 compliance, typo detection, and bulk processing.
  image:
    src: /logo.svg
    alt: mailtester
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/kazmiali/mailtester

features:
  - title: Blazing Fast
    details: 3x faster than alternatives. Single validation under 150ms, bulk 100 emails in under 5 seconds.
  - title: Comprehensive Validation
    details: 5 validators - Regex (RFC 5322), Typo Detection, Disposable Blocking, MX Records, and SMTP verification.
  - title: Lightweight
    details: Only 25KB gzipped with minimal dependencies. No bloat, just what you need.
  - title: TypeScript First
    details: Built with TypeScript 5.3+ strict mode. Full type safety and IntelliSense support.
  - title: Bulk Processing
    details: Process thousands of emails concurrently with built-in rate limiting and progress tracking.
  - title: Zero Config
    details: Works out of the box with sensible defaults. Customize when you need to with presets.
---

## Quick Install

```bash
npm install @mailtester/core
```

## Quick Start

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
// Output: "Valid: 2/3"
```

## Why mailtester?

| Feature | @mailtester/core | deep-email-validator |
|---------|-----------------|---------------------|
| Performance | 3x faster | Slower |
| Bundle Size | 25KB | 50KB+ |
| TypeScript | Native | Basic |
| Bulk Validation | Built-in | No |
| Rate Limiting | Built-in | No |
| Maintained | Active | Limited |
