import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, createLogger, getLogger } from '../../src/utils/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new Logger({ enabled: true });
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logging levels', () => {
    it('should log debug messages when enabled', () => {
      const debugLogger = new Logger({ enabled: true, level: 'debug' });
      debugLogger.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Debug message')
      );
    });

    it('should log info messages when enabled', () => {
      logger.info('Info message');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Info message'));
    });

    it('should log warn messages when enabled', () => {
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Warning message')
      );
    });

    it('should log error messages when enabled', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Error message')
      );
    });

    it('should pass additional arguments to console methods', () => {
      logger.info('Message', { key: 'value' }, 123);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Message'),
        { key: 'value' },
        123
      );
    });
  });

  describe('enable/disable', () => {
    it('should not log when disabled', () => {
      const disabledLogger = new Logger({ enabled: false });
      disabledLogger.debug('Debug');
      disabledLogger.info('Info');
      disabledLogger.warn('Warn');
      disabledLogger.error('Error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should be disabled by default', () => {
      const defaultLogger = new Logger();
      defaultLogger.info('Should not log');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should enable logging', () => {
      const disabledLogger = new Logger({ enabled: false });
      disabledLogger.info('Before enable');
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      disabledLogger.enable();
      disabledLogger.info('After enable');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });

    it('should disable logging', () => {
      logger.info('Before disable');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);

      logger.disable();
      logger.info('After disable');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should check if enabled', () => {
      const enabledLogger = new Logger({ enabled: true });
      const disabledLogger = new Logger({ enabled: false });

      expect(enabledLogger.isEnabled()).toBe(true);
      expect(disabledLogger.isEnabled()).toBe(false);
    });
  });

  describe('log level filtering', () => {
    it('should only log info and above when level is info', () => {
      const infoLogger = new Logger({ enabled: true, level: 'info' });
      infoLogger.debug('Debug');
      infoLogger.info('Info');
      infoLogger.warn('Warn');
      infoLogger.error('Error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should only log warn and above when level is warn', () => {
      const warnLogger = new Logger({ enabled: true, level: 'warn' });
      warnLogger.debug('Debug');
      warnLogger.info('Info');
      warnLogger.warn('Warn');
      warnLogger.error('Error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should only log error when level is error', () => {
      const errorLogger = new Logger({ enabled: true, level: 'error' });
      errorLogger.debug('Debug');
      errorLogger.info('Info');
      errorLogger.warn('Warn');
      errorLogger.error('Error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log all levels when level is debug', () => {
      const debugLogger = new Logger({ enabled: true, level: 'debug' });
      debugLogger.debug('Debug');
      debugLogger.info('Info');
      debugLogger.warn('Warn');
      debugLogger.error('Error');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const testLogger = new Logger({ enabled: true, level: 'info' });
      testLogger.configure({ level: 'warn' });

      testLogger.info('Info');
      testLogger.warn('Warn');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should get current log level', () => {
      const testLogger = new Logger({ enabled: true, level: 'warn' });
      expect(testLogger.getLevel()).toBe('warn');
    });

    it('should set log level', () => {
      const testLogger = new Logger({ enabled: true, level: 'info' });
      testLogger.setLevel('error');

      testLogger.info('Info');
      testLogger.error('Error');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(testLogger.getLevel()).toBe('error');
    });
  });

  describe('message formatting', () => {
    it('should format messages with timestamp and level', () => {
      logger.info('Test message');
      const callArgs = consoleInfoSpy.mock.calls[0];

      expect(callArgs[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
      expect(callArgs[0]).toContain('[INFO]');
      expect(callArgs[0]).toContain('Test message');
    });
  });

  describe('createLogger', () => {
    it('should create a new logger instance', () => {
      const newLogger = createLogger({ enabled: true, level: 'debug' });
      expect(newLogger).toBeInstanceOf(Logger);
      expect(newLogger.isEnabled()).toBe(true);
      expect(newLogger.getLevel()).toBe('debug');
    });

    it('should create logger with default config when no config provided', () => {
      const newLogger = createLogger();
      expect(newLogger.isEnabled()).toBe(false);
      expect(newLogger.getLevel()).toBe('info');
    });
  });

  describe('getLogger', () => {
    it('should return the same default logger instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should return logger with default config', () => {
      const defaultLogger = getLogger();
      expect(defaultLogger.isEnabled()).toBe(false);
      expect(defaultLogger.getLevel()).toBe('info');
    });
  });
});
