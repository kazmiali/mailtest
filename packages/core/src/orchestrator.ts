/**
 * Validation Orchestrator for mailtest
 *
 * Coordinates the validation pipeline, running validators in sequence
 * and aggregating results into a final ValidationResult.
 *
 * @packageDocumentation
 */

import type { ValidationContext } from './context';
import type { ValidationResult } from './types';
import { RegexValidator, type RegexValidatorConfig } from './validators/regex';
import { TypoValidator, type TypoValidatorConfig } from './validators/typo';
import { DisposableValidator, type DisposableValidatorConfig } from './validators/disposable';
import { MXValidator, type MXValidatorConfig } from './validators/mx';
import { SMTPValidator, type SMTPValidatorConfig } from './validators/smtp';
import { BaseValidator } from './validators/base';
import { getLogger } from './utils/logger';

const logger = getLogger();

/**
 * Validation Orchestrator
 *
 * Coordinates the execution of all validators in the validation pipeline.
 * Handles early exit, result aggregation, and final output formatting.
 *
 * @example
 * ```typescript
 * const orchestrator = new ValidationOrchestrator();
 * const context = createContext('user@example.com', config);
 * const result = await orchestrator.validate(context);
 * ```
 */
export class ValidationOrchestrator {
  /**
   * Run the validation pipeline
   *
   * Executes all enabled validators in sequence:
   * 1. Regex validator (format validation)
   * 2. Typo validator (typo detection)
   * 3. Disposable validator (disposable email check)
   * 4. MX validator (DNS MX record check)
   * 5. SMTP validator (mailbox existence check)
   *
   * Stops early if `earlyExit` is enabled and a validator fails.
   *
   * @param context - Validation context with email and configuration
   * @returns Final validation result with aggregated validator results
   */
  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { email, config } = context;

    logger.debug(`Starting validation for: ${email}`);

    // Create validator instances
    const validators = this.createValidators(config);

    // Run validators in sequence
    const validatorOrder: Array<keyof typeof validators> = [
      'regex',
      'typo',
      'disposable',
      'mx',
      'smtp',
    ];

    for (const validatorName of validatorOrder) {
      const validator = validators[validatorName];

      // Skip if validator doesn't exist or is disabled
      if (!validator || !validator.isEnabled()) {
        logger.debug(`Skipping ${validatorName} validator (disabled or not found)`);
        continue;
      }

      try {
        logger.debug(`Running ${validatorName} validator`);
        const result = await validator.validate(email);

        // Store result in context
        context.results[validatorName] = result;

        // Check for early exit
        if (config.earlyExit && !result.valid) {
          logger.debug(`Early exit triggered by ${validatorName} validator`);
          break;
        }
      } catch (error) {
        logger.error(`Error in ${validatorName} validator:`, error);
        // Store error result
        const validatorNameStr = String(validatorName);
        context.results[validatorNameStr] = {
          valid: false,
          validator: validatorNameStr,
          error: {
            code: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error',
            validator: validatorNameStr,
          },
        };

        // Early exit on error if configured
        if (config.earlyExit) {
          logger.debug(`Early exit triggered by ${validatorName} validator error`);
          break;
        }
      }
    }

    // Format and return final result
    return this.formatResult(context);
  }

  /**
   * Create validator instances from configuration
   *
   * @param config - Merged configuration
   * @returns Object containing validator instances
   */
  private createValidators(config: ValidationContext['config']): {
    regex?: RegexValidator;
    typo?: TypoValidator;
    disposable?: DisposableValidator;
    mx?: MXValidator;
    smtp?: SMTPValidator;
    [key: string]: BaseValidator | undefined;
  } {
    const validators: Record<string, BaseValidator | undefined> = {};

    // Create regex validator
    if (config.validators.regex?.enabled) {
      validators.regex = new RegexValidator(config.validators.regex as RegexValidatorConfig);
    }

    // Create typo validator
    if (config.validators.typo?.enabled) {
      validators.typo = new TypoValidator(config.validators.typo as TypoValidatorConfig);
    }

    // Create disposable validator
    if (config.validators.disposable?.enabled) {
      validators.disposable = new DisposableValidator(
        config.validators.disposable as DisposableValidatorConfig
      );
    }

    // Create MX validator
    if (config.validators.mx?.enabled) {
      validators.mx = new MXValidator(config.validators.mx as MXValidatorConfig);
    }

    // Create SMTP validator
    if (config.validators.smtp?.enabled) {
      validators.smtp = new SMTPValidator(config.validators.smtp as SMTPValidatorConfig);
    }

    // Create custom validators (if any)
    for (const [key, validatorConfig] of Object.entries(config.validators)) {
      if (
        !['regex', 'typo', 'disposable', 'mx', 'smtp'].includes(key) &&
        validatorConfig?.enabled
      ) {
        // Custom validators would need to be passed in or registered
        // For now, we skip them as they're not part of the standard pipeline
        logger.debug(
          `Custom validator ${key} detected but not instantiated (not supported in v1.0)`
        );
      }
    }

    return validators as {
      regex?: RegexValidator;
      typo?: TypoValidator;
      disposable?: DisposableValidator;
      mx?: MXValidator;
      smtp?: SMTPValidator;
      [key: string]: BaseValidator | undefined;
    };
  }

  /**
   * Format final validation result from context
   *
   * Aggregates all validator results and calculates overall validity and score.
   *
   * @param context - Validation context with results
   * @returns Formatted validation result
   */
  private formatResult(context: ValidationContext): ValidationResult {
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

    // Calculate score (simple calculation for now, will be enhanced in Phase 6)
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

    const duration = Date.now() - startTime;
    logger.debug(`Validation completed in ${duration}ms. Valid: ${valid}, Score: ${score}`);

    const result: ValidationResult = {
      valid,
      email,
      score,
      validators,
    };

    // Only add reason if validation failed
    if (reason) {
      result.reason = reason;
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
