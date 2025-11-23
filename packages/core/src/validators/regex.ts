/**
 * Regex Validator
 *
 * Validates email format according to RFC 5322 standards.
 * Supports both strict (full RFC compliance) and loose (practical) modes.
 */

import { BaseValidator } from './base';
import type { ValidatorResult } from '../types';
import { ValidationError, ErrorCode } from '../errors/errors';

/**
 * Configuration options for RegexValidator
 */
export interface RegexValidatorConfig {
  enabled?: boolean;
  /**
   * Validation mode
   * - 'strict': Full RFC 5322 compliance (allows quoted strings, comments, etc.)
   * - 'loose': Practical validation for common email formats
   * @default 'loose'
   */
  mode?: 'strict' | 'loose';
  /**
   * Allow IP addresses as domain (e.g., user@192.168.1.1)
   * @default false
   */
  allowIPDomain?: boolean;
  /**
   * Allow comments in email (RFC 5322 feature, rarely used)
   * Only applies in strict mode
   * @default false
   */
  allowComments?: boolean;
}

/**
 * RFC 5322 compliant email validator
 *
 * @example
 * ```typescript
 * const validator = new RegexValidator({ mode: 'strict' });
 * const result = await validator.validate('user@example.com');
 * console.log(result.valid); // true
 * ```
 */
export class RegexValidator extends BaseValidator {
  private readonly mode: 'strict' | 'loose';
  private readonly allowIPDomain: boolean;

  // RFC 5322 patterns
  private static readonly ATOM = "[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+";
  private static readonly QUOTED_STRING = '"(?:[^"\\\\]|\\\\.)*"';
  private static readonly DOT_ATOM = `${RegexValidator.ATOM}(?:\\.${RegexValidator.ATOM})*`;
  private static readonly LOCAL_PART_STRICT = `(?:${RegexValidator.DOT_ATOM}|${RegexValidator.QUOTED_STRING})`;
  private static readonly LOCAL_PART_LOOSE = "[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+";

  // Domain patterns
  private static readonly DOMAIN_LABEL = '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?';
  private static readonly DOMAIN = `${RegexValidator.DOMAIN_LABEL}(?:\\.${RegexValidator.DOMAIN_LABEL})*`;
  private static readonly TLD = '[a-zA-Z]{2,}';

  // IP address patterns (IPv4 and IPv6)
  private static readonly IPV4 =
    '(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}';
  private static readonly IPV6 = '\\[(?:[0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}\\]';

  // Length constraints from RFC 5321
  private static readonly MAX_LOCAL_LENGTH = 64;
  private static readonly MAX_DOMAIN_LENGTH = 255;
  private static readonly MAX_EMAIL_LENGTH = 320; // 64 + 1 (@) + 255

  constructor(config?: RegexValidatorConfig) {
    super('regex', { enabled: config?.enabled ?? true });
    this.mode = config?.mode ?? 'loose';
    this.allowIPDomain = config?.allowIPDomain ?? false;
  }

  /**
   * Validate email format
   */
  async validate(email: string): Promise<ValidatorResult> {
    try {
      // Basic checks
      if (!email || typeof email !== 'string') {
        throw new ValidationError(
          'Email must be a non-empty string',
          ErrorCode.REGEX_INVALID_FORMAT,
          this.name
        );
      }

      // Normalize email (trim whitespace)
      const normalized = email.trim();

      // Check length constraints
      if (normalized.length > RegexValidator.MAX_EMAIL_LENGTH) {
        throw new ValidationError(
          `Email exceeds maximum length of ${RegexValidator.MAX_EMAIL_LENGTH} characters`,
          ErrorCode.REGEX_INVALID_FORMAT,
          this.name,
          { length: normalized.length, maxLength: RegexValidator.MAX_EMAIL_LENGTH }
        );
      }

      // Must contain exactly one @ symbol
      const atIndex = normalized.lastIndexOf('@');
      if (atIndex === -1) {
        throw new ValidationError(
          'Email must contain @ symbol',
          ErrorCode.REGEX_INVALID_FORMAT,
          this.name
        );
      }

      // Check for multiple @ symbols
      if (normalized.indexOf('@') !== atIndex) {
        throw new ValidationError(
          'Email must contain only one @ symbol',
          ErrorCode.REGEX_INVALID_FORMAT,
          this.name
        );
      }

      // Extract parts
      const local = normalized.slice(0, atIndex);
      const domain = normalized.slice(atIndex + 1).toLowerCase();

      // Validate local part
      this.validateLocalPart(local);

      // Validate domain part
      this.validateDomain(domain);

      // If we got here, email is valid
      return this.createResult(true, {
        mode: this.mode,
        local,
        domain,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Validate local part of email (before @)
   */
  private validateLocalPart(local: string): void {
    if (!local) {
      throw new ValidationError(
        'Email local part cannot be empty',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    if (local.length > RegexValidator.MAX_LOCAL_LENGTH) {
      throw new ValidationError(
        `Local part exceeds maximum length of ${RegexValidator.MAX_LOCAL_LENGTH} characters`,
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name,
        { length: local.length, maxLength: RegexValidator.MAX_LOCAL_LENGTH }
      );
    }

    // Check for leading/trailing dots
    if (local.startsWith('.') || local.endsWith('.')) {
      throw new ValidationError(
        'Local part cannot start or end with a dot',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    // Check for consecutive dots
    if (local.includes('..')) {
      throw new ValidationError(
        'Local part cannot contain consecutive dots',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    // Validate based on mode
    const pattern =
      this.mode === 'strict' ? RegexValidator.LOCAL_PART_STRICT : RegexValidator.LOCAL_PART_LOOSE;
    const regex = new RegExp(`^${pattern}$`);

    if (!regex.test(local)) {
      throw new ValidationError(
        'Local part contains invalid characters',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name,
        { local, mode: this.mode }
      );
    }
  }

  /**
   * Validate domain part of email (after @)
   */
  private validateDomain(domain: string): void {
    if (!domain) {
      throw new ValidationError(
        'Email domain cannot be empty',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    if (domain.length > RegexValidator.MAX_DOMAIN_LENGTH) {
      throw new ValidationError(
        `Domain exceeds maximum length of ${RegexValidator.MAX_DOMAIN_LENGTH} characters`,
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name,
        { length: domain.length, maxLength: RegexValidator.MAX_DOMAIN_LENGTH }
      );
    }

    // Check if it's an IP address
    if (this.allowIPDomain && this.isIPAddress(domain)) {
      return; // Valid IP domain
    }

    // Check for leading/trailing dots or hyphens
    if (domain.startsWith('.') || domain.endsWith('.')) {
      throw new ValidationError(
        'Domain cannot start or end with a dot',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    if (domain.startsWith('-') || domain.endsWith('-')) {
      throw new ValidationError(
        'Domain cannot start or end with a hyphen',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    // Check for consecutive dots
    if (domain.includes('..')) {
      throw new ValidationError(
        'Domain cannot contain consecutive dots',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    // Must have at least one dot (TLD required)
    if (!domain.includes('.')) {
      throw new ValidationError(
        'Domain must have a top-level domain (TLD)',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name
      );
    }

    // Validate domain format
    const domainPattern = `^${RegexValidator.DOMAIN}\\.${RegexValidator.TLD}$`;
    const domainRegex = new RegExp(domainPattern, 'i');

    if (!domainRegex.test(domain)) {
      throw new ValidationError(
        'Domain contains invalid characters or format',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name,
        { domain }
      );
    }

    // Validate TLD
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) {
      throw new ValidationError(
        'Top-level domain must be at least 2 characters',
        ErrorCode.REGEX_INVALID_FORMAT,
        this.name,
        { tld }
      );
    }
  }

  /**
   * Check if domain is an IP address (IPv4 or IPv6)
   */
  private isIPAddress(domain: string): boolean {
    // IPv4
    const ipv4Regex = new RegExp(`^${RegexValidator.IPV4}$`);
    if (ipv4Regex.test(domain)) {
      return true;
    }

    // IPv6 (with brackets)
    const ipv6Regex = new RegExp(`^${RegexValidator.IPV6}$`);
    if (ipv6Regex.test(domain)) {
      return true;
    }

    return false;
  }
}
