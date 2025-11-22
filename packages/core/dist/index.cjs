'use strict';

// src/types.ts
var ErrorCode = /* @__PURE__ */ ((ErrorCode2) => {
  ErrorCode2["INVALID_CONFIG"] = "INVALID_CONFIG";
  ErrorCode2["MISSING_REQUIRED_OPTION"] = "MISSING_REQUIRED_OPTION";
  ErrorCode2["REGEX_INVALID_FORMAT"] = "REGEX_INVALID_FORMAT";
  ErrorCode2["TYPO_DETECTED"] = "TYPO_DETECTED";
  ErrorCode2["DISPOSABLE_DOMAIN"] = "DISPOSABLE_DOMAIN";
  ErrorCode2["MX_NOT_FOUND"] = "MX_NOT_FOUND";
  ErrorCode2["MX_LOOKUP_FAILED"] = "MX_LOOKUP_FAILED";
  ErrorCode2["SMTP_MAILBOX_NOT_FOUND"] = "SMTP_MAILBOX_NOT_FOUND";
  ErrorCode2["SMTP_CONNECTION_FAILED"] = "SMTP_CONNECTION_FAILED";
  ErrorCode2["SMTP_TIMEOUT"] = "SMTP_TIMEOUT";
  ErrorCode2["CACHE_ERROR"] = "CACHE_ERROR";
  ErrorCode2["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
  ErrorCode2["PLUGIN_ERROR"] = "PLUGIN_ERROR";
  ErrorCode2["NETWORK_ERROR"] = "NETWORK_ERROR";
  return ErrorCode2;
})(ErrorCode || {});
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number" && !isNaN(value);
}
function isBoolean(value) {
  return typeof value === "boolean";
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function success(data) {
  return { success: true, data };
}
function error(message) {
  return { success: false, error: { message } };
}
function validateEnum(value, allowedValues, errorMessage) {
  if (!isString(value)) {
    return error(`Expected string, got ${typeof value}`);
  }
  if (!allowedValues.includes(value)) {
    return error(errorMessage);
  }
  return success(value);
}
function validateInteger(value, min, max, errorMessage) {
  if (!isNumber(value)) {
    return error(`Expected number, got ${typeof value}`);
  }
  if (!Number.isInteger(value)) {
    return error(errorMessage || "Expected integer");
  }
  if (value < min) {
    return error(errorMessage || `Value must be at least ${min}`);
  }
  return success(value);
}
function validatePositiveInteger(value, errorMessage = "Must be a positive integer") {
  return validateInteger(value, 1, void 0, errorMessage);
}
function validateBoolean(value) {
  if (!isBoolean(value)) {
    return error(`Expected boolean, got ${typeof value}`);
  }
  return success(value);
}
function validateObject(value, validators, allowExtra = false) {
  if (!isObject(value)) {
    return error(`Expected object, got ${typeof value}`);
  }
  const result = {};
  const errors = [];
  for (const [key, validator] of Object.entries(validators)) {
    if (key in value && validator) {
      const fieldResult = validator(value[key]);
      if (fieldResult.success) {
        if (fieldResult.data !== void 0) {
          result[key] = fieldResult.data;
        }
      } else {
        errors.push(`${key}: ${fieldResult.error.message}`);
      }
    }
  }
  if (!allowExtra) {
    for (const key in value) {
      if (!(key in validators)) {
        errors.push(`Unexpected field: ${key}`);
      }
    }
  }
  if (errors.length > 0) {
    return error(errors.join("; "));
  }
  return success(result);
}
function validateOptional(value, validator) {
  if (value === void 0 || value === null) {
    return success(void 0);
  }
  return validator(value);
}

// src/schemas.ts
var Schema = class {
  constructor(validator) {
    this.validator = validator;
  }
  safeParse(value) {
    return this.validator(value);
  }
};
var validatorConfigSchema = new Schema((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, error: { message: "Expected object" } };
  }
  const obj = value;
  if (!("enabled" in obj)) {
    return { success: false, error: { message: "Missing required field: enabled" } };
  }
  const enabledResult = validateBoolean(obj.enabled);
  if (!enabledResult.success) {
    return enabledResult;
  }
  return { success: true, data: { enabled: enabledResult.data } };
});
var validatorOptionsConfigSchema = new Schema((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, error: { message: "Expected object" } };
  }
  const result = {};
  const errors = [];
  for (const [key, val] of Object.entries(value)) {
    if (val === void 0) {
      result[key] = void 0;
    } else if (typeof val === "boolean") {
      result[key] = val;
    } else {
      const configResult = validatorConfigSchema.safeParse(val);
      if (configResult.success) {
        result[key] = configResult.data;
      } else {
        errors.push(`${key}: ${configResult.error.message}`);
      }
    }
  }
  if (errors.length > 0) {
    return { success: false, error: { message: errors.join("; ") } };
  }
  return { success: true, data: result };
});
var presetSchema = new Schema(
  (value) => validateEnum(value, ["strict", "balanced", "permissive"], "Invalid preset")
);
var configSchema = new Schema((value) => {
  const result = validateObject(
    value,
    {
      preset: (val) => validateOptional(val, (v) => presetSchema.safeParse(v)),
      validators: (val) => validateOptional(val, (v) => validatorOptionsConfigSchema.safeParse(v)),
      earlyExit: (val) => validateOptional(val, validateBoolean),
      timeout: (val) => validateOptional(
        val,
        (v) => validatePositiveInteger(v, "Timeout must be a positive integer")
      )
    },
    true
  );
  return result;
});

// src/config/config.ts
var defaultConfig = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }
    // Disabled by default (slow)
  },
  earlyExit: false};
var strictPreset = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: true }
  },
  earlyExit: true
};
var balancedPreset = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: true },
    disposable: { enabled: true },
    mx: { enabled: true },
    smtp: { enabled: false }
  },
  earlyExit: false
};
var permissivePreset = {
  validators: {
    regex: { enabled: true },
    typo: { enabled: false },
    disposable: { enabled: false },
    mx: { enabled: false },
    smtp: { enabled: false }
  },
  earlyExit: true
};
var ConfigManager = class {
  config;
  /**
   * Create a new ConfigManager instance
   *
   * @param userConfig - User-provided configuration (optional)
   * @throws {Error} If configuration is invalid
   */
  constructor(userConfig) {
    if (userConfig) {
      const validationResult = configSchema.safeParse(userConfig);
      if (!validationResult.success) {
        throw new Error(`Invalid configuration: ${validationResult.error.message}`);
      }
    }
    this.config = this.mergeConfigurations(userConfig);
  }
  /**
   * Merge configurations in priority order
   *
   * Priority: defaults -> preset -> user config
   */
  mergeConfigurations(userConfig) {
    let merged = {
      validators: {
        regex: { enabled: defaultConfig.validators.regex.enabled },
        typo: { enabled: defaultConfig.validators.typo.enabled },
        disposable: {
          enabled: defaultConfig.validators.disposable.enabled
        },
        mx: { enabled: defaultConfig.validators.mx.enabled },
        smtp: { enabled: defaultConfig.validators.smtp.enabled }
      },
      earlyExit: defaultConfig.earlyExit,
      timeout: void 0
    };
    if (userConfig?.preset) {
      const preset = this.getPresetConfig(userConfig.preset);
      merged = this.deepMerge(merged, preset);
    }
    if (userConfig) {
      const { preset: _preset, ...configWithoutPreset } = userConfig;
      merged = this.deepMerge(merged, configWithoutPreset);
    }
    const normalizedValidators = this.normalizeValidators(merged.validators ?? {});
    return {
      validators: normalizedValidators,
      earlyExit: merged.earlyExit ?? false,
      timeout: merged.timeout
    };
  }
  /**
   * Get preset configuration
   */
  getPresetConfig(preset) {
    switch (preset) {
      case "strict":
        return {
          validators: {
            regex: { enabled: strictPreset.validators.regex.enabled },
            typo: { enabled: strictPreset.validators.typo.enabled },
            disposable: {
              enabled: strictPreset.validators.disposable.enabled
            },
            mx: { enabled: strictPreset.validators.mx.enabled },
            smtp: { enabled: strictPreset.validators.smtp.enabled }
          },
          earlyExit: strictPreset.earlyExit
        };
      case "balanced":
        return {
          validators: {
            regex: { enabled: balancedPreset.validators.regex.enabled },
            typo: { enabled: balancedPreset.validators.typo.enabled },
            disposable: {
              enabled: balancedPreset.validators.disposable.enabled
            },
            mx: { enabled: balancedPreset.validators.mx.enabled },
            smtp: { enabled: balancedPreset.validators.smtp.enabled }
          },
          earlyExit: balancedPreset.earlyExit
        };
      case "permissive":
        return {
          validators: {
            regex: { enabled: permissivePreset.validators.regex.enabled },
            typo: { enabled: permissivePreset.validators.typo.enabled },
            disposable: {
              enabled: permissivePreset.validators.disposable.enabled
            },
            mx: { enabled: permissivePreset.validators.mx.enabled },
            smtp: { enabled: permissivePreset.validators.smtp.enabled }
          },
          earlyExit: permissivePreset.earlyExit
        };
      default:
        return {};
    }
  }
  /**
   * Deep merge two configuration objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    if (source.validators) {
      result.validators = {
        ...result.validators ?? {},
        ...source.validators
      };
    }
    if (source.earlyExit !== void 0) {
      result.earlyExit = source.earlyExit;
    }
    if (source.timeout !== void 0) {
      result.timeout = source.timeout;
    } else if (source.timeout === void 0 && target.timeout === void 0) {
      result.timeout = void 0;
    }
    return result;
  }
  /**
   * Normalize validators: convert booleans to config objects
   */
  normalizeValidators(validators) {
    const normalized = {};
    for (const [key, value] of Object.entries(validators)) {
      if (value === void 0) {
        continue;
      }
      if (typeof value === "boolean") {
        normalized[key] = { enabled: value };
      } else if (value !== void 0) {
        normalized[key] = value;
      }
    }
    return normalized;
  }
  /**
   * Get the merged configuration
   */
  get() {
    return { ...this.config };
  }
  /**
   * Get a specific configuration value
   *
   * @param key - Configuration key path (e.g., 'validators.regex.enabled')
   */
  getValue(key) {
    const keys = key.split(".");
    let value = this.config;
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        throw new Error(`Configuration key "${key}" not found`);
      }
    }
    return value;
  }
  /**
   * Check if a validator is enabled
   *
   * @param validatorName - Name of the validator
   */
  isValidatorEnabled(validatorName) {
    const validator = this.config.validators[validatorName];
    return validator?.enabled ?? false;
  }
};

// src/errors/errors.ts
var ValidationError = class _ValidationError extends Error {
  code;
  validator;
  details;
  severity;
  constructor(message, code, validator, details, severity = "error") {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.validator = validator;
    this.details = details;
    this.severity = severity;
    if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _ValidationError);
    }
  }
  /**
   * Convert error to ValidationErrorType interface
   */
  toValidationError() {
    const result = {
      code: this.code,
      message: this.message,
      severity: this.severity
    };
    if (this.validator !== void 0) {
      result.validator = this.validator;
    }
    if (this.details !== void 0) {
      result.details = this.details;
    }
    return result;
  }
};
var ConfigurationError = class extends ValidationError {
  constructor(message, code = "INVALID_CONFIG" /* INVALID_CONFIG */, details) {
    super(message, code, void 0, details, "error");
    this.name = "ConfigurationError";
  }
};
var NetworkError = class extends ValidationError {
  constructor(message, validator, details) {
    super(message, "NETWORK_ERROR" /* NETWORK_ERROR */, validator, details, "error");
    this.name = "NetworkError";
  }
};
var TimeoutError = class extends ValidationError {
  constructor(message, validator, timeout, details) {
    super(
      message,
      "SMTP_TIMEOUT" /* SMTP_TIMEOUT */,
      validator,
      { timeout, ...details },
      "error"
    );
    this.name = "TimeoutError";
  }
};
var ERROR_MESSAGES = {
  // Configuration errors
  ["INVALID_CONFIG" /* INVALID_CONFIG */]: {
    message: "Invalid configuration provided",
    suggestion: "Check your configuration object for invalid values",
    severity: "error"
  },
  ["MISSING_REQUIRED_OPTION" /* MISSING_REQUIRED_OPTION */]: {
    message: "Missing required configuration option",
    suggestion: "Check the documentation for required configuration options",
    severity: "error"
  },
  // Validation errors
  ["REGEX_INVALID_FORMAT" /* REGEX_INVALID_FORMAT */]: {
    message: "Email format is invalid",
    suggestion: "Ensure email contains @ symbol and domain with extension",
    severity: "error"
  },
  ["TYPO_DETECTED" /* TYPO_DETECTED */]: {
    message: "Possible typo in email domain",
    suggestion: (details) => {
      const suggestion = details?.suggestion;
      return suggestion ? `Did you mean ${suggestion}?` : "Check the domain spelling";
    },
    severity: "warning"
  },
  ["DISPOSABLE_DOMAIN" /* DISPOSABLE_DOMAIN */]: {
    message: "Disposable email addresses are not allowed",
    suggestion: "Please use a permanent email address",
    severity: "error"
  },
  ["MX_NOT_FOUND" /* MX_NOT_FOUND */]: {
    message: "No MX records found for domain",
    suggestion: "Verify the domain exists and has mail servers configured",
    severity: "error"
  },
  ["MX_LOOKUP_FAILED" /* MX_LOOKUP_FAILED */]: {
    message: "Failed to lookup MX records",
    suggestion: "Check your network connection and DNS settings",
    severity: "error"
  },
  ["SMTP_MAILBOX_NOT_FOUND" /* SMTP_MAILBOX_NOT_FOUND */]: {
    message: "Email address does not exist",
    suggestion: "Verify the email address is correct",
    severity: "error"
  },
  ["SMTP_CONNECTION_FAILED" /* SMTP_CONNECTION_FAILED */]: {
    message: "Failed to connect to mail server",
    suggestion: "The mail server may be temporarily unavailable",
    severity: "error"
  },
  ["SMTP_TIMEOUT" /* SMTP_TIMEOUT */]: {
    message: "SMTP validation timed out",
    suggestion: "The mail server may be slow or unreachable",
    severity: "error"
  },
  // System errors
  ["CACHE_ERROR" /* CACHE_ERROR */]: {
    message: "Cache operation failed",
    suggestion: "Check cache configuration",
    severity: "warning"
  },
  ["RATE_LIMIT_EXCEEDED" /* RATE_LIMIT_EXCEEDED */]: {
    message: "Rate limit exceeded",
    suggestion: "Wait before retrying or adjust rate limit settings",
    severity: "warning"
  },
  ["PLUGIN_ERROR" /* PLUGIN_ERROR */]: {
    message: "Plugin error occurred",
    suggestion: "Check plugin configuration and logs",
    severity: "error"
  },
  ["NETWORK_ERROR" /* NETWORK_ERROR */]: {
    message: "Network error occurred",
    suggestion: "Check your network connection and try again",
    severity: "error"
  }
};
function createError(code, validator, details) {
  const template = ERROR_MESSAGES[code] ?? {
    message: "An error occurred",
    severity: "error"
  };
  const message = template.message;
  const severity = template.severity;
  return new ValidationError(message, code, validator, details, severity);
}

// src/utils/logger.ts
var logDebug = (...args) => {
  console.debug(...args);
};
var logInfo = (...args) => {
  console.info(...args);
};
var logWarn = (...args) => {
  console.warn(...args);
};
var logError = (...args) => {
  console.error(...args);
};
var defaultConfig2 = {
  enabled: false,
  // Disabled by default
  level: "info"
};
var LOG_LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
var Logger = class {
  config;
  constructor(config) {
    this.config = {
      enabled: config?.enabled ?? defaultConfig2.enabled,
      level: config?.level ?? defaultConfig2.level
    };
  }
  /**
   * Check if a log level should be output
   */
  shouldLog(level) {
    if (!this.config.enabled) {
      return false;
    }
    const levelPriority = LOG_LEVEL_PRIORITY[level];
    const configPriority = LOG_LEVEL_PRIORITY[this.config.level];
    return levelPriority >= configPriority;
  }
  /**
   * Format log message with prefix
   */
  formatMessage(level, message) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }
  /**
   * Log debug message
   */
  debug(message, ...args) {
    if (this.shouldLog("debug")) {
      logDebug(this.formatMessage("debug", message), ...args);
    }
  }
  /**
   * Log info message
   */
  info(message, ...args) {
    if (this.shouldLog("info")) {
      logInfo(this.formatMessage("info", message), ...args);
    }
  }
  /**
   * Log warning message
   */
  warn(message, ...args) {
    if (this.shouldLog("warn")) {
      logWarn(this.formatMessage("warn", message), ...args);
    }
  }
  /**
   * Log error message
   */
  error(message, ...args) {
    if (this.shouldLog("error")) {
      logError(this.formatMessage("error", message), ...args);
    }
  }
  /**
   * Update logger configuration
   */
  configure(config) {
    this.config = {
      enabled: config.enabled ?? this.config.enabled,
      level: config.level ?? this.config.level
    };
  }
  /**
   * Enable logging
   */
  enable() {
    this.config.enabled = true;
  }
  /**
   * Disable logging
   */
  disable() {
    this.config.enabled = false;
  }
  /**
   * Check if logger is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }
  /**
   * Get current log level
   */
  getLevel() {
    return this.config.level;
  }
  /**
   * Set log level
   */
  setLevel(level) {
    this.config.level = level;
  }
};
var defaultLogger;
function getLogger() {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}
function createLogger(config) {
  return new Logger(config);
}

// src/index.ts
function validateEmail2(email) {
  if (!email || typeof email !== "string") {
    return false;
  }
  return email.includes("@");
}
var VERSION = "1.0.0";

exports.ConfigManager = ConfigManager;
exports.ConfigurationError = ConfigurationError;
exports.ERROR_MESSAGES = ERROR_MESSAGES;
exports.ErrorCode = ErrorCode;
exports.Logger = Logger;
exports.NetworkError = NetworkError;
exports.TimeoutError = TimeoutError;
exports.VERSION = VERSION;
exports.ValidationError = ValidationError;
exports.createError = createError;
exports.createLogger = createLogger;
exports.getLogger = getLogger;
exports.validateEmail = validateEmail2;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map