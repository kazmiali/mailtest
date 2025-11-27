/**
 * Validation Orchestrator for mailtester
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
import { ResultFormatter } from './output/formatter';

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
  private formatter: ResultFormatter;

  constructor() {
    this.formatter = new ResultFormatter();
  }
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
    return this.formatter.format(context);
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
}
