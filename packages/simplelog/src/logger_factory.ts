import { trace } from "@opentelemetry/api";

const ANSI_RESET_COLOR = 0;
const ANSI_GREEN = 32;
const ANSI_YELLOW = 33;
const ANSI_RED = 31;
const ANSI_CYAN = 36;
const ANSI_BLUE = 34;
const ANSI_MAGENTA = 35;
const ANSI_GRAY = 90;
const EMPTY_FUNCTION_NAME_LENGTH = 0;
const JSON_INDENTATION = 2;
const STACK_TRACE_HEADER_LINE_COUNT = 2;
const ROOT_STACK_TRACE_INDEX = 0;
const DEFAULT_LOG_LEVEL = "DEBUG";
const DEFAULT_STACK_TRACE = "";
const FALLBACK_OBJECT_STRING = "[Object]";
const EMPTY_OPEN_TELEMETRY_CONTEXT: OpenTelemetryContext = {
  spanId: "",
  traceId: "",
};
const CAPTURE_STACK_TRACE_MESSAGE = "simplelog";
const FUNCTION_LABEL_PREFIX = "[Function ";
const FUNCTION_LABEL_SUFFIX = "]";
const ANONYMOUS_FUNCTION_LABEL = "[Function anonymous]";
const LOGGER_NAME_SEPARATOR = " -> ";
const LOG_FILE_LINE_BREAK = "\n";
const NODE_MODULES_SEGMENT = "node_modules";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type OpenTelemetryContext = Readonly<{
  spanId: string;
  traceId: string;
}>;

type ValueColorMode = "level" | "off" | "syntax";

type LoggerOptions = Readonly<{
  includeOpenTelemetryContext?: boolean;
  logFilePath?: string;
  logLevelThreshold?: LogLevel;
  valueColorMode?: ValueColorMode;
  writeToFile?: boolean;
}>;

type LoggerConsole = Readonly<{
  error: (...args: readonly unknown[]) => void;
  log: (...args: readonly unknown[]) => void;
}>;

type LoggerRuntime = Readonly<{
  appendTextFileSync?: (filePath: string, content: string) => void;
  console: LoggerConsole;
}>;

type LoggerParent = Readonly<{
  getFullLoggerName: () => string;
  getInheritedOptions: () => LoggerOptions;
}>;

type LoggerConstructor = new (
  name: string,
  parent?: LoggerParent,
  options?: LoggerOptions,
) => LoggerBase;

type ResolvedLoggerOptions = Readonly<{
  includeOpenTelemetryContext: boolean;
  logFilePath: string;
  logLevelThreshold: LogLevel;
  valueColorMode: ValueColorMode;
  writeToFile: boolean;
}>;

type LogPayload = Readonly<{
  consoleArgs: readonly string[];
  consoleLogMessage: string;
  consoleStackTrace: string;
  plainLogMessage: string;
  plainStackTrace: string;
}>;

type PlainLogParts = Readonly<{
  openTelemetryContext?: OpenTelemetryContext;
  plainArgs: readonly StringifiedArgument[];
  plainLogMessage: string;
  plainStackTrace: string;
  timestamp: string;
}>;

type StringifiablePrimitive = bigint | boolean | number | string | symbol;

type StringifiedArgument = Readonly<{
  kind: StringifiedArgumentKind;
  text: string;
}>;

type StringifiedArgumentKind =
  | "boolean"
  | "function"
  | "nullish"
  | "number"
  | "object"
  | "string"
  | "symbol";

const LOG_LEVEL_COLORS: Readonly<Record<LogLevel, number>> = {
  DEBUG: ANSI_CYAN,
  ERROR: ANSI_RED,
  INFO: ANSI_GREEN,
  WARN: ANSI_YELLOW,
};

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  DEBUG: 1,
  ERROR: 4,
  INFO: 2,
  WARN: 3,
};

function colorize(text: string, colorCode: number): string {
  return `\u001B[${colorCode}m${text}\u001B[${ANSI_RESET_COLOR}m`;
}

function createLoggerConsole(): LoggerConsole {
  return {
    error(...args: readonly unknown[]): void {
      globalThis.console.error(...args);
    },
    log(...args: readonly unknown[]): void {
      globalThis.console.log(...args);
    },
  };
}

function buildDefaultLogFilePath(loggerName: string): string {
  return `logs/${loggerName}.log`;
}

function resolveLoggerOptions(
  loggerName: string,
  options: LoggerOptions,
): ResolvedLoggerOptions {
  return {
    includeOpenTelemetryContext: options.includeOpenTelemetryContext ?? false,
    logFilePath: options.logFilePath ?? buildDefaultLogFilePath(loggerName),
    logLevelThreshold: options.logLevelThreshold ?? DEFAULT_LOG_LEVEL,
    valueColorMode: options.valueColorMode ?? "level",
    writeToFile: options.writeToFile ?? false,
  };
}

function captureStackTrace(message = CAPTURE_STACK_TRACE_MESSAGE): string {
  return new Error(message).stack ?? DEFAULT_STACK_TRACE;
}

function minimizeStackTrace(stackTrace: string): string {
  const lines = stackTrace.split(LOG_FILE_LINE_BREAK);

  if (lines.length <= STACK_TRACE_HEADER_LINE_COUNT) {
    return stackTrace;
  }

  const filteredLines = lines.filter((line, index) => {
    if (index === ROOT_STACK_TRACE_INDEX) {
      return true;
    }

    return !line.includes(NODE_MODULES_SEGMENT);
  });

  return filteredLines.join(LOG_FILE_LINE_BREAK);
}

function isPrimitiveArgument(
  argument: unknown,
): argument is StringifiablePrimitive {
  return (
    typeof argument === "bigint" ||
    typeof argument === "boolean" ||
    typeof argument === "number" ||
    typeof argument === "string" ||
    typeof argument === "symbol"
  );
}

function stringifyPrimitiveArgument(argument: StringifiablePrimitive): StringifiedArgument {
  if (typeof argument === "string") {
    return {
      kind: "string",
      text: argument,
    };
  }

  if (typeof argument === "symbol") {
    return {
      kind: "symbol",
      text: argument.toString(),
    };
  }

  if (typeof argument === "boolean") {
    return {
      kind: "boolean",
      text: `${argument}`,
    };
  }

  return {
    kind: "number",
    text: `${argument}`,
  };
}

function stringifyFunctionArgument(functionName: string): StringifiedArgument {
  if (functionName.length === EMPTY_FUNCTION_NAME_LENGTH) {
    return {
      kind: "function",
      text: ANONYMOUS_FUNCTION_LABEL,
    };
  }

  return {
    kind: "function",
    text: `${FUNCTION_LABEL_PREFIX}${functionName}${FUNCTION_LABEL_SUFFIX}`,
  };
}

function identityJsonReplacer(_key: string, value: unknown): unknown {
  return value;
}

function stringifyJsonArgument(argument: unknown): StringifiedArgument {
  try {
    const stringifiedArgument = JSON.stringify(
      argument,
      identityJsonReplacer,
      JSON_INDENTATION,
    );

    if (typeof stringifiedArgument !== "string") {
      return {
        kind: "object",
        text: FALLBACK_OBJECT_STRING,
      };
    }

    return {
      kind: "object",
      text: stringifiedArgument,
    };
  } catch {
    return {
      kind: "object",
      text: FALLBACK_OBJECT_STRING,
    };
  }
}

function stringifyArgument(argument: unknown): StringifiedArgument {
  if (typeof argument === "undefined") {
    return {
      kind: "nullish",
      text: "undefined",
    };
  }

  if (argument === null) {
    return {
      kind: "nullish",
      text: "null",
    };
  }

  if (isPrimitiveArgument(argument)) {
    return stringifyPrimitiveArgument(argument);
  }

  if (typeof argument === "function") {
    return stringifyFunctionArgument(argument.name);
  }

  return stringifyJsonArgument(argument);
}

function stringifyArguments(
  argumentsList: readonly unknown[],
): readonly StringifiedArgument[] {
  return argumentsList.map((argument) => {
    return stringifyArgument(argument);
  });
}

function buildLogMessage(
  timestamp: string,
  levelLabel: string,
  loggerName: string,
  openTelemetryContextLabel: string,
  message: string,
): string {
  return `${timestamp} ${levelLabel} [${loggerName}]${openTelemetryContextLabel} - ${message}`;
}

function resolveStackTrace(stackTrace?: string): string {
  if (typeof stackTrace === "string") {
    return minimizeStackTrace(stackTrace);
  }

  return DEFAULT_STACK_TRACE;
}

function buildColoredLogMessage(
  level: LogLevel,
  timestamp: string,
  loggerName: string,
  openTelemetryContextLabel: string,
  message: string,
): string {
  const colorCode = LOG_LEVEL_COLORS[level];

  return buildLogMessage(
    colorize(timestamp, colorCode),
    colorize(`[${level}]`, colorCode),
    colorize(loggerName, colorCode),
    openTelemetryContextLabel,
    colorize(message, colorCode),
  );
}

function formatOpenTelemetryContextLabel(
  openTelemetryContext?: OpenTelemetryContext,
): string {
  if (
    typeof openTelemetryContext !== "object" ||
    openTelemetryContext.spanId.length === EMPTY_FUNCTION_NAME_LENGTH ||
    openTelemetryContext.traceId.length === EMPTY_FUNCTION_NAME_LENGTH
  ) {
    return "";
  }

  return ` [trace_id=${openTelemetryContext.traceId} span_id=${openTelemetryContext.spanId}]`;
}

function colorizeOpenTelemetryContextLabel(
  level: LogLevel,
  openTelemetryContext: OpenTelemetryContext | undefined,
  valueColorMode: ValueColorMode,
): string {
  const plainOpenTelemetryContextLabel = formatOpenTelemetryContextLabel(
    openTelemetryContext,
  );

  if (
    valueColorMode === "off" ||
    plainOpenTelemetryContextLabel.length === EMPTY_FUNCTION_NAME_LENGTH
  ) {
    return plainOpenTelemetryContextLabel;
  }

  if (valueColorMode === "syntax") {
    return colorize(plainOpenTelemetryContextLabel, ANSI_GRAY);
  }

  return colorize(plainOpenTelemetryContextLabel, LOG_LEVEL_COLORS[level]);
}

function getSyntaxColorCode(kind: StringifiedArgumentKind): number {
  switch (kind) {
    case "boolean": {
      return ANSI_YELLOW;
    }
    case "function": {
      return ANSI_MAGENTA;
    }
    case "nullish": {
      return ANSI_GRAY;
    }
    case "number": {
      return ANSI_CYAN;
    }
    case "object": {
      return ANSI_BLUE;
    }
    case "string": {
      return ANSI_GREEN;
    }
    case "symbol": {
      return ANSI_MAGENTA;
    }
    default: {
      return ANSI_GREEN;
    }
  }
}

function colorizeArguments(
  argumentsList: readonly StringifiedArgument[],
  level: LogLevel,
  valueColorMode: ValueColorMode,
): readonly string[] {
  if (valueColorMode === "off") {
    return argumentsList.map((argument) => {
      return argument.text;
    });
  }

  if (valueColorMode === "syntax") {
    return argumentsList.map((argument) => {
      return colorize(argument.text, getSyntaxColorCode(argument.kind));
    });
  }

  const colorCode = LOG_LEVEL_COLORS[level];

  return argumentsList.map((argument) => {
    return colorize(argument.text, colorCode);
  });
}

function buildPlainConsoleLogMessage(
  level: LogLevel,
  timestamp: string,
  loggerName: string,
  openTelemetryContext: OpenTelemetryContext | undefined,
  message: string,
): string {
  return buildLogMessage(
    timestamp,
    `[${level}]`,
    loggerName,
    formatOpenTelemetryContextLabel(openTelemetryContext),
    message,
  );
}

function buildConsoleLogMessage(
  level: LogLevel,
  timestamp: string,
  loggerName: string,
  openTelemetryContext: OpenTelemetryContext | undefined,
  message: string,
  valueColorMode: ValueColorMode,
): string {
  if (valueColorMode === "off") {
    return buildPlainConsoleLogMessage(
      level,
      timestamp,
      loggerName,
      openTelemetryContext,
      message,
    );
  }

  return buildColoredLogMessage(
    level,
    timestamp,
    loggerName,
    colorizeOpenTelemetryContextLabel(
      level,
      openTelemetryContext,
      valueColorMode,
    ),
    message,
  );
}

function buildConsoleStackTrace(
  stackTrace: string,
  level: LogLevel,
  valueColorMode: ValueColorMode,
): string {
  if (valueColorMode === "off") {
    return stackTrace;
  }

  return colorize(stackTrace, LOG_LEVEL_COLORS[level]);
}

function createConsolePayload(
  level: LogLevel,
  timestamp: string,
  loggerName: string,
  openTelemetryContext: OpenTelemetryContext | undefined,
  message: string,
  plainArgs: readonly StringifiedArgument[],
  plainStackTrace: string,
  valueColorMode: ValueColorMode,
): Pick<LogPayload, "consoleArgs" | "consoleLogMessage" | "consoleStackTrace"> {
  return {
    consoleArgs: colorizeArguments(plainArgs, level, valueColorMode),
    consoleLogMessage: buildConsoleLogMessage(
      level,
      timestamp,
      loggerName,
      openTelemetryContext,
      message,
      valueColorMode,
    ),
    consoleStackTrace: buildConsoleStackTrace(
      plainStackTrace,
      level,
      valueColorMode,
    ),
  };
}

function createPlainLogParts(
  level: LogLevel,
  loggerName: string,
  openTelemetryContext: OpenTelemetryContext | undefined,
  message: string,
  args: readonly unknown[],
  stackTrace?: string,
): PlainLogParts {
  const plainStackTrace = resolveStackTrace(stackTrace);
  const timestamp = new Date().toISOString();

  return {
    openTelemetryContext,
    plainArgs: stringifyArguments(args),
    plainLogMessage: buildLogMessage(
      timestamp,
      `[${level}]`,
      loggerName,
      formatOpenTelemetryContextLabel(openTelemetryContext),
      message,
    ),
    plainStackTrace,
    timestamp,
  };
}

function resolveOpenTelemetryContext(
  includeOpenTelemetryContext: boolean,
): OpenTelemetryContext {
  if (!includeOpenTelemetryContext) {
    return EMPTY_OPEN_TELEMETRY_CONTEXT;
  }

  const activeSpan = trace.getActiveSpan();

  if (typeof activeSpan === "undefined") {
    return EMPTY_OPEN_TELEMETRY_CONTEXT;
  }

  const spanContext = activeSpan.spanContext();

  return {
    spanId: spanContext.spanId,
    traceId: spanContext.traceId,
  };
}

function combineLogPayload(
  consolePayload: Pick<
    LogPayload,
    "consoleArgs" | "consoleLogMessage" | "consoleStackTrace"
  >,
  plainLogParts: PlainLogParts,
): LogPayload {
  return {
    ...consolePayload,
    plainLogMessage: plainLogParts.plainLogMessage,
    plainStackTrace: plainLogParts.plainStackTrace,
  };
}

function createConsolePayloadFromPlainLogParts(
  level: LogLevel,
  loggerName: string,
  message: string,
  plainLogParts: PlainLogParts,
  valueColorMode: ValueColorMode,
): Pick<LogPayload, "consoleArgs" | "consoleLogMessage" | "consoleStackTrace"> {
  return createConsolePayload(
    level,
    plainLogParts.timestamp,
    loggerName,
    plainLogParts.openTelemetryContext,
    message,
    plainLogParts.plainArgs,
    plainLogParts.plainStackTrace,
    valueColorMode,
  );
}

function createLogPayload(
  level: LogLevel,
  loggerName: string,
  message: string,
  args: readonly unknown[],
  includeOpenTelemetryContext: boolean,
  valueColorMode: ValueColorMode,
  stackTrace?: string,
): LogPayload {
  const openTelemetryContext = resolveOpenTelemetryContext(
    includeOpenTelemetryContext,
  );
  const plainLogParts = createPlainLogParts(
    level,
    loggerName,
    openTelemetryContext,
    message,
    args,
    stackTrace,
  );
  const consolePayload = createConsolePayloadFromPlainLogParts(
    level,
    loggerName,
    message,
    plainLogParts,
    valueColorMode,
  );

  return combineLogPayload(consolePayload, plainLogParts);
}

function writeLogLine(
  runtime: LoggerRuntime,
  writeToFile: boolean,
  logFilePath: string,
  logMessage: string,
): void {
  if (!writeToFile) {
    return;
  }

  const { appendTextFileSync } = runtime;

  if (typeof appendTextFileSync !== "function") {
    return;
  }

  appendTextFileSync(logFilePath, `${logMessage}${LOG_FILE_LINE_BREAK}`);
}

function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[threshold];
}

class LoggerBase {
  private readonly LoggerConstructor: LoggerConstructor;
  private readonly logFilePath: string;
  private readonly logLevelThreshold: LogLevel;
  private readonly name: string;
  private readonly parent?: LoggerParent;
  private readonly performanceBenchmarks = new Map<string, number>();
  private readonly runtime: LoggerRuntime;
  private readonly includeOpenTelemetryContext: boolean;
  private readonly valueColorMode: ValueColorMode;
  private readonly writeToFile: boolean;

  protected constructor(
    LoggerConstructor: LoggerConstructor,
    runtime: LoggerRuntime,
    name: string,
    parent?: LoggerParent,
    options: LoggerOptions = {},
  ) {
    const resolvedOptions = resolveLoggerOptions(name, options);

    this.LoggerConstructor = LoggerConstructor;
    this.includeOpenTelemetryContext = resolvedOptions.includeOpenTelemetryContext;
    this.logFilePath = resolvedOptions.logFilePath;
    this.logLevelThreshold = resolvedOptions.logLevelThreshold;
    this.name = name;
    this.parent = parent;
    this.runtime = runtime;
    this.valueColorMode = resolvedOptions.valueColorMode;
    this.writeToFile = resolvedOptions.writeToFile;
  }

  public assert(
    condition: boolean,
    message: string,
    ...args: readonly unknown[]
  ): void {
    if (condition) {
      return;
    }

    const assertionMessage = `Assertion failed: ${message}`;

    this.log("ERROR", assertionMessage, args, captureStackTrace(assertionMessage));
  }

  public createChildLogger(
    name: string,
    otherLogger?: LoggerParent,
  ): LoggerBase {
    if (typeof otherLogger === "object") {
      return new this.LoggerConstructor(
        name,
        this.mergeLoggers(otherLogger),
        this.getInheritedOptions(),
      );
    }

    return new this.LoggerConstructor(name, this, this.getInheritedOptions());
  }

  public debug(message: string, ...args: readonly unknown[]): void {
    this.log("DEBUG", message, args);
  }

  public endPerformanceBenchmark(label: string, message: string): void {
    const startTime = this.performanceBenchmarks.get(label);

    if (typeof startTime !== "number") {
      this.warn(
        `No start time found for performance test with label "${label}"`,
      );
      return;
    }

    const elapsedMilliseconds = Date.now() - startTime;

    this.debug(`${message} - Elapsed Time: ${elapsedMilliseconds}ms`);
    this.performanceBenchmarks.delete(label);
  }

  public error(message: string, ...args: readonly unknown[]): void {
    this.log("ERROR", message, args, captureStackTrace(message));
  }

  public getFullLoggerName(): string {
    if (typeof this.parent === "object") {
      return `${this.parent.getFullLoggerName()}${LOGGER_NAME_SEPARATOR}${this.name}`;
    }

    return this.name;
  }

  public getInheritedOptions(): LoggerOptions {
    return {
      includeOpenTelemetryContext: this.includeOpenTelemetryContext,
      logFilePath: this.logFilePath,
      logLevelThreshold: this.logLevelThreshold,
      valueColorMode: this.valueColorMode,
      writeToFile: this.writeToFile,
    };
  }

  public info(message: string, ...args: readonly unknown[]): void {
    this.log("INFO", message, args);
  }

  public startPerformanceBenchmark(label: string): void {
    this.performanceBenchmarks.set(label, Date.now());
  }

  public warn(message: string, ...args: readonly unknown[]): void {
    this.log("WARN", message, args);
  }

  private log(
    level: LogLevel,
    message: string,
    args: readonly unknown[],
    stackTrace?: string,
  ): void {
    if (!shouldLog(level, this.logLevelThreshold)) {
      return;
    }

    const payload = createLogPayload(
      level,
      this.getFullLoggerName(),
      message,
      args,
      this.includeOpenTelemetryContext,
      this.valueColorMode,
      stackTrace,
    );

    writeLogLine(
      this.runtime,
      this.writeToFile,
      this.logFilePath,
      payload.plainLogMessage,
    );
    this.runtime.console.log(payload.consoleLogMessage, ...payload.consoleArgs);
    this.logStackTrace(payload.plainStackTrace, payload.consoleStackTrace);
  }

  private logStackTrace(
    plainStackTrace: string,
    coloredStackTrace: string,
  ): void {
    if (plainStackTrace.length === EMPTY_FUNCTION_NAME_LENGTH) {
      return;
    }

    writeLogLine(
      this.runtime,
      this.writeToFile,
      this.logFilePath,
      plainStackTrace,
    );
    this.runtime.console.error(coloredStackTrace);
  }

  private mergeLoggers(otherLogger: LoggerParent): LoggerParent {
    return new this.LoggerConstructor(
      this.name,
      otherLogger,
      this.getInheritedOptions(),
    );
  }
}

export { LoggerBase, createLoggerConsole };
export type {
  LogLevel,
  LoggerConsole,
  LoggerConstructor,
  LoggerOptions,
  LoggerParent,
  LoggerRuntime,
  ValueColorMode,
};
