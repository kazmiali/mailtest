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
  - icon: ⚡
    title: Blazing Fast
    details: 3x faster than alternatives. Single validation under 150ms, bulk 100 emails in under 5 seconds.
  - icon: 🎯
    title: Comprehensive Validation
    details: 5 validators - Regex (RFC 5322), Typo Detection, Disposable Blocking, MX Records, and SMTP verification.
  - icon: 📦
    title: Lightweight
    details: Only ~25KB gzipped with minimal dependencies. No bloat, just what you need.
  - icon: 🔒
    title: TypeScript First
    details: Built with TypeScript 5.3+ strict mode. Full type safety and IntelliSense support.
  - icon: 🚀
    title: Bulk Processing
    details: Process thousands of emails concurrently with built-in rate limiting and progress tracking.
  - icon: ⚙️
    title: Zero Config
    details: Works out of the box with sensible defaults. Customize when you need to with presets.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #6366f1 30%, #8b5cf6);
  --vp-home-hero-image-background-image: none;
  --vp-home-hero-image-filter: none;
}
</style>

## Quick Install

```bash
npm install @mailtester/core
```

## Quick Start

```typescript
import { validate } from '@mailtester/core';

const result = await validate('user@gmail.com');

console.log(result.valid);  // true
console.log(result.score);  // 85 (0-100 score)
```

## Why mailtester?

| Feature | @mailtester/core | deep-email-validator |
|---------|-----------------|---------------------|
| Performance | ⚡ 3x faster | Slower |
| Bundle Size | 📦 ~25KB | ~50KB+ |
| TypeScript | ✅ Native | ⚠️ Basic |
| Bulk Validation | ✅ Built-in | ❌ No |
| Rate Limiting | ✅ Built-in | ❌ No |
| Maintained | ✅ Active | ⚠️ Limited |

