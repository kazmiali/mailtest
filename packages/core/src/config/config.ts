/**
 * Configuration Manager for mailtest
 *
 * Handles configuration merging, presets, and validation
 *
 * @packageDocumentation
 */

import { configSchema } from '../schemas';
import type { ValidatorConfig } from '../types';

/**
 * Default configuration
 */
const defaultConfig = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }, // Disabled by default (slow)
  },
  earlyExit: false,
  timeout: undefined,
} as const;

/**
 * Strict preset configuration
 * All validators enabled, early exit on first failure
 */
const strictPreset = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: true },
  },
  earlyExit: true,
} as const;

/**
 * Balanced preset configuration (default)
 * Most validators enabled, SMTP disabled for speed
 */
const balancedPreset = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false },
  },
  earlyExit: false,
} as const;

/**
 * Permissive preset configuration
 * Only regex validation enabled
 */
const permissivePreset = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: false },
    disposable: { enabled: false },
    mx: { enabled: false },
    smtp: { enabled: false },
  },
  earlyExit: true,
} as const;

/**
 * Configuration type
 */
export interface Config {
  validators?: {
    regex?: ValidatorConfig | boolean;
    typo?: ValidatorConfig | boolean;
    disposable?: ValidatorConfig | boolean;
    mx?: ValidatorConfig | boolean;
    smtp?: ValidatorConfig | boolean;
    [key: string]: ValidatorConfig | boolean | undefined;
  };
  earlyExit?: boolean;
  timeout?: number;
  preset?: 'strict' | 'balanced' | 'permissive';
}

/**
 * Merged configuration type (after processing)
 */
export interface MergedConfig {
  validators: Record<string, ValidatorConfig>;
  earlyExit: boolean;
  timeout: number | undefined;
}

/**
 * Configuration Manager class
 *
 * Handles configuration merging, validation, and preset loading
 */
export class ConfigManager {
  private config: MergedConfig;

  /**
   * Create a new ConfigManager instance
   *
   * @param userConfig - User-provided configuration (optional)
   * @throws {Error} If configuration is invalid
   */
  constructor(userConfig?: Partial<Config>) {
    // Validate user config
    if (userConfig) {
      const validationResult = configSchema.safeParse(userConfig);
      if (!validationResult.success) {
        throw new Error(`Invalid configuration: ${validationResult.error.message}`);
      }
    }

    // Merge configurations in order: defaults -> preset -> user config
    this.config = this.mergeConfigurations(userConfig);
  }

  /**
   * Merge configurations in priority order
   *
   * Priority: defaults -> preset -> user config
   */
  private mergeConfigurations(userConfig?: Partial<Config>): MergedConfig {
    // Start with defaults
    let merged: Partial<MergedConfig> = {
      validators: {
        regex: { enabled: defaultConfig.validators.regex.enabled },
        typo: { enabled: defaultConfig.validators.typo.enabled },
        disposable: {
          enabled: defaultConfig.validators.disposable.enabled,
        },
        mx: { enabled: defaultConfig.validators.mx.enabled },
        smtp: { enabled: defaultConfig.validators.smtp.enabled },
      },
      earlyExit: defaultConfig.earlyExit,
      timeout: defaultConfig.timeout ?? undefined,
    };

    // Apply preset if specified
    if (userConfig?.preset) {
      const preset = this.getPresetConfig(userConfig.preset);
      merged = this.deepMerge(merged, preset);
    }

    // Apply user config (highest priority)
    if (userConfig) {
      const { preset: _preset, ...configWithoutPreset } = userConfig;
      merged = this.deepMerge(merged, configWithoutPreset);
    }

    // Normalize validators (convert booleans to config objects)
    const normalizedValidators = this.normalizeValidators(merged.validators ?? {});

    return {
      validators: normalizedValidators,
      earlyExit: merged.earlyExit ?? false,
      timeout: merged.timeout,
    };
  }

  /**
   * Get preset configuration
   */
  private getPresetConfig(preset: 'strict' | 'balanced' | 'permissive'): Partial<Config> {
    switch (preset) {
      case 'strict':
        return {
          validators: {
            regex: { enabled: strictPreset.validators.regex.enabled },
            typo: { enabled: strictPreset.validators.typo.enabled },
            disposable: {
              enabled: strictPreset.validators.disposable.enabled,
            },
            mx: { enabled: strictPreset.validators.mx.enabled },
            smtp: { enabled: strictPreset.validators.smtp.enabled },
          },
          earlyExit: strictPreset.earlyExit,
        };
      case 'balanced':
        return {
          validators: {
            regex: { enabled: balancedPreset.validators.regex.enabled },
            typo: { enabled: balancedPreset.validators.typo.enabled },
            disposable: {
              enabled: balancedPreset.validators.disposable.enabled,
            },
            mx: { enabled: balancedPreset.validators.mx.enabled },
            smtp: { enabled: balancedPreset.validators.smtp.enabled },
          },
          earlyExit: balancedPreset.earlyExit,
        };
      case 'permissive':
        return {
          validators: {
            regex: { enabled: permissivePreset.validators.regex.enabled },
            typo: { enabled: permissivePreset.validators.typo.enabled },
            disposable: {
              enabled: permissivePreset.validators.disposable.enabled,
            },
            mx: { enabled: permissivePreset.validators.mx.enabled },
            smtp: { enabled: permissivePreset.validators.smtp.enabled },
          },
          earlyExit: permissivePreset.earlyExit,
        };
      default:
        return {};
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private deepMerge(target: Partial<MergedConfig>, source: Partial<Config>): Partial<MergedConfig> {
    const result: Partial<MergedConfig> = { ...target };

    // Merge validators
    if (source.validators) {
      result.validators = {
        ...(result.validators ?? {}),
        ...source.validators,
      } as Record<string, ValidatorConfig>;
    }

    // Merge other properties
    if (source.earlyExit !== undefined) {
      result.earlyExit = source.earlyExit;
    }

    if (source.timeout !== undefined) {
      result.timeout = source.timeout;
    } else if (source.timeout === undefined && target.timeout === undefined) {
      result.timeout = undefined;
    }

    return result;
  }

  /**
   * Normalize validators: convert booleans to config objects
   */
  private normalizeValidators(
    validators: Record<string, ValidatorConfig | boolean | undefined>
  ): Record<string, ValidatorConfig> {
    const normalized: Record<string, ValidatorConfig> = {};

    for (const [key, value] of Object.entries(validators)) {
      if (value === undefined) {
        continue;
      }

      if (typeof value === 'boolean') {
        normalized[key] = { enabled: value };
      } else if (value !== undefined) {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  /**
   * Get the merged configuration
   */
  get(): MergedConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   *
   * @param key - Configuration key path (e.g., 'validators.regex.enabled')
   */
  getValue<T = unknown>(key: string): T {
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k];
      } else {
        throw new Error(`Configuration key "${key}" not found`);
      }
    }

    return value as T;
  }

  /**
   * Check if a validator is enabled
   *
   * @param validatorName - Name of the validator
   */
  isValidatorEnabled(validatorName: string): boolean {
    const validator = this.config.validators[validatorName];
    return validator?.enabled ?? false;
  }
}
