/**
 * Simple logger utility for mailtest
 *
 * Provides configurable logging with different severity levels
 *
 * @packageDocumentation
 */

// Console methods (available in Node.js runtime)
const logDebug = (...args: unknown[]): void => {
  // @ts-expect-error - console is available in Node.js runtime
  console.debug(...args);
};

const logInfo = (...args: unknown[]): void => {
  // @ts-expect-error - console is available in Node.js runtime
  console.info(...args);
};

const logWarn = (...args: unknown[]): void => {
  // @ts-expect-error - console is available in Node.js runtime
  console.warn(...args);
};

const logError = (...args: unknown[]): void => {
  // @ts-expect-error - console is available in Node.js runtime
  console.error(...args);
};

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Enable or disable logging */
  enabled?: boolean;

  /** Minimum log level to output */
  level?: LogLevel;
}

/**
 * Default logger configuration
 */
const defaultConfig: Required<LoggerConfig> = {
  enabled: false, // Disabled by default
  level: 'info',
};

/**
 * Log level priority (higher number = higher priority)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger class
 *
 * Simple, configurable logger with different severity levels
 */
export class Logger {
  private config: Required<LoggerConfig>;

  constructor(config?: LoggerConfig) {
    this.config = {
      enabled: config?.enabled ?? defaultConfig.enabled,
      level: config?.level ?? defaultConfig.level,
    };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
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
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      logDebug(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      logInfo(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      logWarn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      logError(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Update logger configuration
   */
  configure(config: LoggerConfig): void {
    this.config = {
      enabled: config.enabled ?? this.config.enabled,
      level: config.level ?? this.config.level,
    };
  }

  /**
   * Enable logging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable logging
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Check if logger is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

/**
 * Default logger instance
 */
let defaultLogger: Logger | undefined;

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

/**
 * Create a new logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}
