/**
 * Disposable Email Checker Validator
 *
 * Identifies temporary/disposable email services to prevent fake signups.
 * Uses disposable-email-domains dataset with lazy loading, pattern-based detection,
 * and custom blacklist/whitelist support.
 */

import { BaseValidator } from './base';
import type { ValidatorResult } from '../types';
import { ValidationError, ErrorCode } from '../errors/errors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

/**
 * Configuration options for DisposableValidator
 */
export interface DisposableValidatorConfig {
  enabled?: boolean;
  /**
   * Custom blacklist of domains to always treat as disposable
   * @default []
   */
  customBlacklist?: string[];
  /**
   * Custom whitelist of domains to always allow (even if in disposable list)
   * @default []
   */
  customWhitelist?: string[];
  /**
   * Enable pattern-based detection for disposable domains
   * Detects patterns like "10minutemail", "tempmail", etc.
   * @default true
   */
  enablePatternDetection?: boolean;
}

/**
 * Common patterns that indicate disposable email services
 * These patterns are often used in disposable email domain names
 */
const DISPOSABLE_PATTERNS = [
  /^10minutemail/i,
  /^tempmail/i,
  /^temp-mail/i,
  /^throwaway/i,
  /^trashmail/i,
  /^guerrillamail/i,
  /^mailinator/i,
  /^mintemail/i,
  /^yopmail/i,
  /^dispostable/i,
  /^fakeinbox/i,
  /^maildrop/i,
  /^getnada/i,
  /^emailondeck/i,
  /^sharklasers/i,
  /^mohmal/i,
  /^meltmail/i,
  /^spamgourmet/i,
  /^spamhole/i,
  /^spamtraps/i,
  /^spam\./i,
  /^temp\./i,
  /^tmp\./i,
  /^test\./i,
  /^throwaway\./i,
  /^trash\./i,
  /^disposable\./i,
  /^fake\./i,
  /^spam\./i,
  /^noreply\./i,
  /^no-reply\./i,
  /^donotreply\./i,
  /^do-not-reply\./i,
];

/**
 * Lazy-loaded disposable domains set
 * Loaded only when first validation is performed
 */
let disposableDomainsSet: Set<string> | null = null;

/**
 * Load disposable domains from disposable-email-domains package
 * Uses lazy loading to avoid loading large dataset until needed
 * Works in both ESM and CJS contexts using createRequire
 *
 * @returns Set of disposable domain strings
 */
function loadDisposableDomains(): Set<string> {
  if (disposableDomainsSet === null) {
    try {
      // Use createRequire to support both ESM and CJS contexts
      const requireFn = createRequire(import.meta.url);
      const disposableDomains = requireFn('disposable-email-domains');
      disposableDomainsSet = new Set(Array.isArray(disposableDomains) ? disposableDomains : []);
    } catch (requireError) {
      // If require fails, try reading JSON file directly
      try {
        const requireFn = createRequire(import.meta.url);
        const packagePath = requireFn.resolve('disposable-email-domains');
        const jsonContent = readFileSync(packagePath, 'utf-8');
        const disposableDomains = JSON.parse(jsonContent);
        disposableDomainsSet = new Set(Array.isArray(disposableDomains) ? disposableDomains : []);
      } catch (fileError) {
        // Final fallback: try to find node_modules relative to current file
        try {
          const currentDir =
            typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
          const packagePath = join(
            currentDir,
            '../../node_modules/disposable-email-domains/index.json'
          );
          const jsonContent = readFileSync(packagePath, 'utf-8');
          const disposableDomains = JSON.parse(jsonContent);
          disposableDomainsSet = new Set(Array.isArray(disposableDomains) ? disposableDomains : []);
        } catch (fallbackError) {
          throw new Error(
            `Failed to load disposable-email-domains. Require error: ${requireError instanceof Error ? requireError.message : String(requireError)}, File error: ${fileError instanceof Error ? fileError.message : String(fileError)}, Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
          );
        }
      }
    }
  }
  return disposableDomainsSet;
}

/**
 * Check if domain matches any disposable pattern
 *
 * @param domain - Domain to check
 * @returns True if domain matches a disposable pattern
 */
function matchesDisposablePattern(domain: string): boolean {
  return DISPOSABLE_PATTERNS.some((pattern) => pattern.test(domain));
}

/**
 * Disposable email detection validator
 *
 * Checks if an email domain is a known disposable email service.
 * Supports lazy loading, pattern-based detection, and custom blacklist/whitelist.
 *
 * @example
 * ```typescript
 * const validator = new DisposableValidator({
 *   customWhitelist: ['company.com'],
 *   enablePatternDetection: true
 * });
 * const result = await validator.validate('user@mailinator.com');
 * // result.valid = false
 * // result.error.code = 'DISPOSABLE_DOMAIN'
 * ```
 */
export class DisposableValidator extends BaseValidator {
  private readonly customBlacklist: Set<string>;
  private readonly customWhitelist: Set<string>;
  private readonly enablePatternDetection: boolean;

  constructor(config?: DisposableValidatorConfig) {
    super('disposable', { enabled: config?.enabled ?? true });

    // Normalize blacklist/whitelist domains to lowercase
    this.customBlacklist = new Set(
      (config?.customBlacklist ?? []).map((domain) => domain.toLowerCase())
    );
    this.customWhitelist = new Set(
      (config?.customWhitelist ?? []).map((domain) => domain.toLowerCase())
    );
    this.enablePatternDetection = config?.enablePatternDetection ?? true;
  }

  /**
   * Validate email for disposable domain
   */
  async validate(email: string): Promise<ValidatorResult> {
    try {
      // Basic checks
      if (!email || typeof email !== 'string') {
        throw new ValidationError(
          'Email must be a non-empty string',
          ErrorCode.DISPOSABLE_DOMAIN,
          this.name
        );
      }

      // Normalize email
      const normalized = this.normalizeEmail(email);

      // Extract domain for validation
      const domain = this.extractDomain(normalized);
      if (!domain) {
        throw new ValidationError(
          'Invalid email format: missing domain',
          ErrorCode.DISPOSABLE_DOMAIN,
          this.name
        );
      }

      const domainLower = domain.toLowerCase();

      // Check whitelist first (whitelist overrides everything)
      if (this.customWhitelist.has(domainLower)) {
        return this.createResult(true, {
          checked: true,
          whitelisted: true,
          domain,
        });
      }

      // Check custom blacklist
      if (this.customBlacklist.has(domainLower)) {
        return this.createErrorResult(
          new ValidationError(
            `Domain ${domain} is in custom blacklist`,
            ErrorCode.DISPOSABLE_DOMAIN,
            this.name,
            {
              domain,
              reason: 'custom_blacklist',
            }
          )
        );
      }

      // Load disposable domains set (lazy loading)
      const disposableDomains = loadDisposableDomains();

      // Check if domain is in disposable list (O(1) lookup)
      // Check this before pattern detection to prioritize known_disposable reason
      if (disposableDomains.has(domainLower)) {
        return this.createErrorResult(
          new ValidationError(
            `Domain ${domain} is a known disposable email service`,
            ErrorCode.DISPOSABLE_DOMAIN,
            this.name,
            {
              domain,
              reason: 'known_disposable',
            }
          )
        );
      }

      // Check pattern-based detection if enabled
      // Only check patterns for domains not in the disposable list
      if (this.enablePatternDetection && matchesDisposablePattern(domainLower)) {
        return this.createErrorResult(
          new ValidationError(
            `Domain ${domain} matches disposable email pattern`,
            ErrorCode.DISPOSABLE_DOMAIN,
            this.name,
            {
              domain,
              reason: 'pattern_match',
            }
          )
        );
      }

      // Domain is not disposable
      return this.createResult(true, {
        checked: true,
        domain,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
