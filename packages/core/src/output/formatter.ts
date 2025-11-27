/**
 * Result Formatter for mailtester
 *
 * Formats validation results consistently and adds metadata like timestamp and duration.
 *
 * @packageDocumentation
 */

import type { ValidationContext } from '../context';
import type { ValidationResult } from '../types';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Result Formatter
 *
 * Formats validation context into a consistent ValidationResult with metadata.
 *
 * @example
 * ```typescript
 * const formatter = new ResultFormatter();
 * const result = formatter.format(context);
 * ```
 */
export class ResultFormatter {
  /**
   * Format validation context into final result
   *
   * Aggregates all validator results, calculates overall validity and score,
   * and adds metadata like timestamp and duration.
   *
   * @param context - Validation context with results
   * @param includeMetadata - Whether to include metadata (default: true)
   * @returns Formatted validation result
   */
  format(context: ValidationContext, includeMetadata = true): ValidationResult {
    const { email, results, startTime } = context;

    // Determine overall validity
    // Email is valid if all validators that ran passed
    // Note: Typo validator warnings don't fail validation
    let valid = true;
    let reason: ValidationResult['reason'] | undefined;

    // Check each validator result
    for (const [validatorName, result] of Object.entries(results)) {
      if (result && !result.valid) {
        // Typo validator warnings don't fail validation
        if (validatorName === 'typo' && result.error?.severity === 'warning') {
          continue; // Skip typo warnings, they don't fail validation
        }

        // This is a real failure
        valid = false;
        // Set reason to first failing validator
        if (!reason) {
          reason = validatorName as ValidationResult['reason'];
        }
      }
    }

    // Calculate score
    const score = this.calculateScore(results);

    // Build validators object
    const validators: ValidationResult['validators'] = {
      ...(results.regex && { regex: results.regex }),
      ...(results.typo && { typo: results.typo }),
      ...(results.disposable && { disposable: results.disposable }),
      ...(results.mx && { mx: results.mx }),
      ...(results.smtp && { smtp: results.smtp }),
    };

    // Add custom validator results
    for (const [key, result] of Object.entries(results)) {
      if (!['regex', 'typo', 'disposable', 'mx', 'smtp'].includes(key) && result) {
        validators[key] = result;
      }
    }

    // Build result object
    const result: ValidationResult = {
      valid,
      email,
      score,
      validators,
    };

    // Add reason if validation failed
    if (reason) {
      result.reason = reason;
    }

    // Add metadata if requested
    if (includeMetadata) {
      const duration = Date.now() - startTime;
      result.metadata = {
        timestamp: new Date().toISOString(),
        duration,
      };

      logger.debug(`Validation completed in ${duration}ms. Valid: ${valid}, Score: ${score}`);
    }

    return result;
  }

  /**
   * Calculate reputation score from validator results
   *
   * Simple scoring algorithm (will be enhanced in Phase 6):
   * - Each passing validator contributes points
   * - Regex: 20 points
   * - Typo: 10 points (if no typo detected)
   * - Disposable: 20 points (if not disposable)
   * - MX: 20 points (if MX records found)
   * - SMTP: 30 points (if mailbox exists)
   *
   * @param results - Validator results
   * @returns Score from 0-100
   */
  private calculateScore(results: ValidationContext['results']): number {
    let score = 0;

    // Regex validator: 20 points
    if (results.regex?.valid) {
      score += 20;
    }

    // Typo validator: 10 points (if no typo detected)
    if (results.typo?.valid) {
      score += 10;
    }

    // Disposable validator: 20 points (if not disposable)
    if (results.disposable?.valid) {
      score += 20;
    }

    // MX validator: 20 points (if MX records found)
    if (results.mx?.valid) {
      score += 20;
    }

    // SMTP validator: 30 points (if mailbox exists)
    if (results.smtp?.valid) {
      score += 30;
    }

    return Math.min(100, Math.max(0, score));
  }
}
