/**
 * Typo Detector Validator
 *
 * Detects and suggests corrections for common email domain typos.
 * Uses mailcheck library with expanded TLD coverage and custom domain support.
 */

import { BaseValidator } from './base';
import type { ValidatorResult } from '../types';
import { ValidationError, ErrorCode } from '../errors/errors';
import mailcheck from 'mailcheck';

/**
 * Configuration options for TypoValidator
 */
export interface TypoValidatorConfig {
  enabled?: boolean;
  /**
   * Custom list of domains to check against
   * @default mailcheck.defaultDomains
   */
  domains?: string[];
  /**
   * Custom list of second-level domains (e.g., "yahoo", "hotmail")
   * @default mailcheck.defaultSecondLevelDomains
   */
  secondLevelDomains?: string[];
  /**
   * Custom list of top-level domains (e.g., "com", "net", "org")
   * Expanded to 100+ TLDs by default
   * @default expanded defaultTopLevelDomains
   */
  topLevelDomains?: string[];
  /**
   * Confidence threshold (0-1) for accepting suggestions
   * Lower values = more suggestions, higher values = fewer suggestions
   * @default 0.8
   */
  threshold?: number;
}

/**
 * Expanded list of top-level domains (100+ TLDs)
 * Includes common TLDs from mailcheck plus additional popular TLDs
 */
const EXPANDED_TOP_LEVEL_DOMAINS = [
  // Original mailcheck TLDs
  'com',
  'com.au',
  'com.tw',
  'ca',
  'co.nz',
  'co.uk',
  'de',
  'fr',
  'it',
  'ru',
  'net',
  'org',
  'edu',
  'gov',
  'jp',
  'nl',
  'kr',
  'se',
  'eu',
  'ie',
  'co.il',
  'us',
  'at',
  'be',
  'dk',
  'hk',
  'es',
  'gr',
  'ch',
  'no',
  'cz',
  'in',
  'net.au',
  'info',
  'biz',
  'mil',
  'co.jp',
  'sg',
  'hu',
  // Additional popular TLDs
  'io',
  'co',
  'me',
  'tv',
  'cc',
  'ws',
  'name',
  'mobi',
  'asia',
  'tel',
  'travel',
  'pro',
  'aero',
  'coop',
  'museum',
  'xxx',
  'jobs',
  'cat',
  'post',
  'xxx',
  'app',
  'dev',
  'tech',
  'online',
  'site',
  'website',
  'store',
  'shop',
  'blog',
  'cloud',
  'email',
  'news',
  'media',
  'space',
  'world',
  'global',
  'digital',
  'network',
  'systems',
  'solutions',
  'services',
  'support',
  'help',
  'info',
  'click',
  'link',
  'click',
  'top',
  'xyz',
  'win',
  'bid',
  'download',
  'stream',
  'video',
  'photo',
  'pics',
  'pictures',
  'gallery',
  'photo',
  'photos',
  'pics',
  'pictures',
  'gallery',
  'design',
  'art',
  'music',
  'movie',
  'film',
  'video',
  'tv',
  'radio',
  'live',
  'life',
  'love',
  'fun',
  'cool',
  'best',
  'new',
  'now',
  'today',
  'here',
  'there',
  'everywhere',
];

/**
 * Typo detection validator
 *
 * Detects common typos in email domains and suggests corrections.
 * Uses mailcheck library with expanded TLD coverage.
 *
 * @example
 * ```typescript
 * const validator = new TypoValidator({
 *   threshold: 0.8,
 *   domains: ['company.com', 'subsidiary.com']
 * });
 * const result = await validator.validate('user@gmaill.com');
 * // result.valid = false
 * // result.error.suggestion = "Did you mean user@gmail.com?"
 * ```
 */
export class TypoValidator extends BaseValidator {
  private readonly domains: string[];
  private readonly secondLevelDomains: string[];
  private readonly topLevelDomains: string[];
  private readonly threshold: number;

  constructor(config?: TypoValidatorConfig) {
    super('typo', { enabled: config?.enabled ?? true });

    // Use custom domains or default from mailcheck
    this.domains = config?.domains ?? mailcheck.defaultDomains;
    this.secondLevelDomains = config?.secondLevelDomains ?? mailcheck.defaultSecondLevelDomains;
    this.topLevelDomains = config?.topLevelDomains ?? EXPANDED_TOP_LEVEL_DOMAINS;
    this.threshold = config?.threshold ?? 0.8;
  }

  /**
   * Validate email for typos
   */
  async validate(email: string): Promise<ValidatorResult> {
    try {
      // Basic checks
      if (!email || typeof email !== 'string') {
        throw new ValidationError(
          'Email must be a non-empty string',
          ErrorCode.TYPO_DETECTED,
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
          ErrorCode.TYPO_DETECTED,
          this.name
        );
      }

      // Use mailcheck to detect typos
      // mailcheck.run() returns synchronously, so we wrap it in Promise.resolve()
      const suggestion = await Promise.resolve(
        mailcheck.run({
          email: normalized,
          domains: this.domains,
          secondLevelDomains: this.secondLevelDomains,
          topLevelDomains: this.topLevelDomains,
        })
      );

      // If no suggestion, email domain is correct
      if (!suggestion) {
        return this.createResult(true, {
          checked: true,
          suggestion: null,
        });
      }

      // Calculate confidence score based on distance
      // Lower distance = higher confidence
      const distance = mailcheck.sift3Distance(domain, suggestion.domain);
      const maxLength = Math.max(domain.length, suggestion.domain.length);
      const confidence = maxLength > 0 ? 1 - distance / maxLength : 0;

      // If confidence is below threshold, don't flag as typo
      if (confidence < this.threshold) {
        return this.createResult(true, {
          checked: true,
          suggestion: suggestion.full,
          confidence,
          belowThreshold: true,
        });
      }

      // Typo detected with sufficient confidence
      const suggestedEmail = suggestion.full;

      // Create error result with suggestion
      return {
        valid: false,
        validator: this.name,
        error: {
          code: ErrorCode.TYPO_DETECTED,
          message: `Possible typo in domain: ${domain}`,
          suggestion: `Did you mean ${suggestedEmail}?`,
          severity: 'warning',
          validator: this.name,
          details: {
            original: normalized,
            suggestion: suggestedEmail,
            confidence,
            domain: suggestion.domain,
          },
        },
        details: {
          checked: true,
          suggestion: suggestedEmail,
          confidence,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
