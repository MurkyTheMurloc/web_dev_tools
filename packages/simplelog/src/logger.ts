import console from "node:console";
import { appendFileSync } from "node:fs";
const LOG_LEVEL = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

type LogLevel = keyof typeof LOG_LEVEL;

const LOG_LEVEL_PRIORITY = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
} as const;

type LoggerOptions = {
  writeToFile: boolean;
  logFilePath: string;
  logLevelThreshold: LogLevel; // Minimum log level for logging
};
const LOG_LEVEL_COLORS: Record<LogLevel, number> = {
  [LOG_LEVEL.DEBUG]: 36, // Cyan
  [LOG_LEVEL.INFO]: 32, // Green
  [LOG_LEVEL.WARN]: 33, // Yellow
  [LOG_LEVEL.ERROR]: 31, // Red
};

/**
 * Logger class for logging messages with different log levels.
 */
export class Logger {
  private name: string;
  private parent?: Logger;
  private performanceTests: Record<string, number> = {};
  private writeToFile: boolean;
  private logFilePath: string;
  private logLevelThreshold: LogLevel;

  /**
   * Creates an instance of Logger.
   * @param {string} name - The name of the logger.
   * @param {Logger} [parent] - The parent logger.
   * @param {LoggerOptions} [options] - Logger options.
   */
  constructor(
    name: string,
    parent?: Logger,
    options: LoggerOptions = {
      writeToFile: false,
      logFilePath: `logs/${name}.log`,
      logLevelThreshold: "DEBUG",
    }
  ) {
    this.name = name;
    this.parent = parent;

    this.logFilePath = options.logFilePath;

    this.writeToFile = options.writeToFile;
    this.logLevelThreshold = options.logLevelThreshold;
  }

  /**
   * Starts a performance benchmark with a given label.
   * @param {string} label - The label for the performance test.
   */
  startPerformanceBenchmark(label: string): void {
    this.performanceTests[label] = Date.now();
  }

  /**
   * Ends a performance benchmark with a given label and logs the elapsed time.
   * @param {string} label - The label for the performance test.
   * @param {string} message - The message to log with the elapsed time.
   */
  endPerformanceBenchmark(label: string, message: string): void {
    const startTime = this.performanceTests[label];
    if (startTime !== undefined) {
      const endTime = Date.now();
      const elapsedMilliseconds = endTime - startTime;
      this.debug(`${message} - Elapsed Time: ${elapsedMilliseconds}ms`);
      delete this.performanceTests[label];
    } else {
      this.warn(
        `No start time found for performance test with label "${label}"`
      );
    }
  }

  /**
   * Logs a debug message.
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  debug(message: string, ...args: unknown[]): void {
    this.log(LOG_LEVEL.DEBUG, message, args);
  }

  /**
   * Logs an info message.
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  info(message: string, ...args: unknown[]): void {
    this.log(LOG_LEVEL.INFO, message, args);
  }

  /**
   * Logs a warning message.
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  warn(message: string, ...args: unknown[]): void {
    this.log(LOG_LEVEL.WARN, message, args);
  }

  /**
   * Logs an error message.
   * @param {string} message - The message to log.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  error(message: string, ...args: unknown[]): void {
    const stackTrace = new Error().stack || "";
    this.log(LOG_LEVEL.ERROR, message, args, stackTrace);
  }

  /**
   * Asserts a condition and logs an error if the condition is false.
   * @param {boolean} condition - The condition to check.
   * @param {string} message - The message to log if the condition is false.
   * @param {...unknown[]} args - Additional arguments to log.
   */
  assert(condition: boolean, message: string, ...args: unknown[]): void {
    if (!condition) {
      const stackTrace = new Error().stack || "";
      this.log(
        LOG_LEVEL.ERROR,
        `Assertion failed: ${message}`,
        args,
        stackTrace
      );
    }
  }

  /**
   * Creates a child logger.
   * @param {string} name - The name of the child logger.
   * @param {Logger} [otherLogger] - Another logger to merge with.
   * @returns {Logger} The child logger.
   */
  createChildLogger(name: string, otherLogger?: Logger): Logger {
    const mergedParent = otherLogger ? this.mergeLoggers(otherLogger) : this;
    return new Logger(name, mergedParent);
  }

  /**
   * Merges two loggers by nesting them.
   * @param {Logger} otherLogger - The other logger to merge with.
   * @returns {Logger} The merged logger.
   */
  private mergeLoggers(otherLogger: Logger): Logger {
    return new Logger(this.name, otherLogger);
  }

  /**
   * Colorizes a text string.
   * @param {string} text - The text to colorize.
   * @param {number} colorCode - The color code to use.
   * @returns {string} The colorized text.
   */
  private colorize(text: string, colorCode: number): string {
    const resetCode = 0;
    return `\u001b[${colorCode}m${String(text)}\u001b[${resetCode}m`;
  }

  /**
   * Minimizes a stack trace by filtering out lines containing "node_modules".
   * @param {string} stackTrace - The stack trace to minimize.
   * @returns {string} The minimized stack trace.
   */
  private minimizeStackTrace(stackTrace: string): string {
    const lines = stackTrace.split("\n");
    if (lines.length <= 2) {
      return stackTrace;
    }
    const filteredLines = lines.filter(
      (line, index) => index === 0 || !line.includes("node_modules")
    );
    return filteredLines.join("\n");
  }

  /**
   * Stringifies an array of arguments.
   * @param {unknown[]} args - The arguments to stringify.
   * @returns {string[]} The stringified arguments.
   */
  private stringifyArgs(args: unknown[]): string[] {
    return args.map((arg: unknown) => {
      if (arg === undefined) return "undefined";
      if (arg === null) return "null";
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return "[Object]";
        }
      }
      return String(arg);
    });
  }

  /**
   * Gets the full logger name, including parent loggers.
   * @param {LogLevel} level - The log level.
   * @returns {string} The full logger name.
   */
  private getFullLoggerName(level: LogLevel): string {
    const fullLoggerName = this.parent
      ? `${this.parent.getFullLoggerName(level)} -> ${this.name}`
      : this.name;
    return this.colorize(fullLoggerName, LOG_LEVEL_COLORS[level]);
  }

  /**
   * Logs a message with a given log level.
   * @param {LogLevel} level - The log level.
   * @param {string} message - The message to log.
   * @param {unknown[]} [args=[]] - Additional arguments to log.
   * @param {string} [stackTrace] - The stack trace to log.
   */
  private log(
    level: LogLevel,
    message: string,
    args: unknown[] = [],
    stackTrace?: string
  ): void {
    if (!this.shouldLog(level)) {
      return; // Skip logging if the level is below the threshold
    }
    const fullLoggerName = this.getFullLoggerName(level);
    const LOG_LEVELText = this.colorize(`[${level}]`, LOG_LEVEL_COLORS[level]);
    const timestamp = new Date().toISOString();
    const logMessage = `${this.colorize(
      timestamp,
      LOG_LEVEL_COLORS[level]
    )} ${LOG_LEVELText} [${this.colorize(
      fullLoggerName,
      LOG_LEVEL_COLORS[level]
    )}] - ${this.colorize(message, LOG_LEVEL_COLORS[level])}`;
    if (this.writeToFile) {
      this.writeLogToFile(logMessage);
    }
    const stringifiedArgs = this.stringifyArgs(args);
    console.log(logMessage, ...stringifiedArgs);

    if (stackTrace) {
      const minimizedStackTrace = this.minimizeStackTrace(stackTrace);
      if (this.writeToFile) {
        this.writeLogToFile(minimizedStackTrace);
      }
      console.error(
        this.colorize(minimizedStackTrace, LOG_LEVEL_COLORS[level])
      );
    }
  }

  /**
   * Checks if a message should be logged based on the log level threshold.
   * @param {LogLevel} level - The log level.
   * @returns {boolean} True if the message should be logged, false otherwise.
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.logLevelThreshold]
    );
  }

  /**
   * Writes a log message to a file.
   * @param {string} logMessage - The log message to write.
   */
  private writeLogToFile(logMessage: string) {
    if (this.writeToFile) {
      appendFileSync(this.logFilePath, logMessage + "\n", "utf-8");
    }
  }
}
