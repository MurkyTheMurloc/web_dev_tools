import type { TimestampFormat } from "./console_timestamp";

const DEFAULT_LOG_LEVEL = "DEBUG";
const DEFAULT_STACK_TRACE = "";
const EMPTY_LENGTH = 0;
const EMPTY_OPEN_TELEMETRY_CONTEXT: OpenTelemetryContext = {
    spanId: "",
    traceId: ""
};
const CAPTURE_STACK_TRACE_MESSAGE = "simplelog";
const LOGGER_NAME_SEPARATOR = " -> ";
const LINE_BREAK = "\n";
const NODE_MODULES_SEGMENT = "node_modules";
const STACK_TRACE_HEADER_LINE_COUNT = 2;
const ROOT_STACK_TRACE_INDEX = 0;

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
    /** Console only; log files always get the ISO timestamp. */
    timestampFormat?: TimestampFormat;
    valueColorMode?: ValueColorMode;
    writeToFile?: boolean;
}>;

/** What a logger uses for the console options its caller left out. */
type ConsoleDefaults = Readonly<{
    timestampFormat: TimestampFormat;
    valueColorMode: ValueColorMode;
}>;

type LoggerConsole = Readonly<{
    error: (...args: readonly unknown[]) => void;
    log: (...args: readonly unknown[]) => void;
}>;

/** One log call that passed the level threshold. */
type LogEntry = Readonly<{
    args: readonly unknown[];
    epochMilliseconds: number;
    level: LogLevel;
    loggerName: string;
    message: string;
    openTelemetryContext: OpenTelemetryContext;
    /** The minimized stack trace, or `""` when the call has none. */
    stackTrace: string;
}>;

/** A logger's resolved output options, the same for every call. */
type LogOutput = Readonly<{
    logFilePath: string;
    timestampFormat: TimestampFormat;
    valueColorMode: ValueColorMode;
    writeToFile: boolean;
}>;

type LogWriter = (entry: LogEntry, output: LogOutput) => void;

type LoggerRuntime = Readonly<{
    /**
     * Reads the environment (NO_COLOR, FORCE_COLOR, SIMPLELOG_TIMESTAMP,
     * whether stdout is a terminal) once per logger, when it is constructed.
     * Runtimes without one (the browser) get
     * {@link FALLBACK_CONSOLE_DEFAULTS}.
     */
    readConsoleDefaults?: () => ConsoleDefaults;
    /**
     * Formats and prints one entry. All output code sits behind it, so an entry
     * bundles only the writer it uses: the browser gets neither the text
     * formatting (`./console_text`) nor the log file (`./log_file`).
     */
    write: LogWriter;
}>;

type LoggerParent = Readonly<{
    getFullLoggerName: () => string;
    getInheritedOptions: () => LoggerOptions;
}>;

type LoggerConstructor = new (
    name: string,
    parent?: LoggerParent,
    options?: LoggerOptions
) => LoggerBase;

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
    DEBUG: 1,
    ERROR: 4,
    INFO: 2,
    WARN: 3
};

function createLoggerConsole(): LoggerConsole {
    return {
        error(...args: readonly unknown[]): void {
            globalThis.console.error(...args);
        },
        log(...args: readonly unknown[]): void {
            globalThis.console.log(...args);
        }
    };
}

function buildDefaultLogFilePath(loggerName: string): string {
    return `logs/${loggerName}.log`;
}

// The browser console renders ANSI codes, and there is no terminal to ask.
const FALLBACK_CONSOLE_DEFAULTS: ConsoleDefaults = {
    timestampFormat: "iso",
    valueColorMode: "level"
};

function readConsoleDefaults(
    runtime: LoggerRuntime,
    options: LoggerOptions
): ConsoleDefaults {
    // Child loggers pass both, so they never read the environment again.
    if (
        typeof options.timestampFormat === "string" &&
        typeof options.valueColorMode === "string"
    ) {
        return FALLBACK_CONSOLE_DEFAULTS;
    }

    return runtime.readConsoleDefaults?.() ?? FALLBACK_CONSOLE_DEFAULTS;
}

function resolveLogOutput(
    loggerName: string,
    options: LoggerOptions,
    runtime: LoggerRuntime
): LogOutput {
    const consoleDefaults = readConsoleDefaults(runtime, options);

    return {
        logFilePath: options.logFilePath ?? buildDefaultLogFilePath(loggerName),
        timestampFormat:
            options.timestampFormat ?? consoleDefaults.timestampFormat,
        valueColorMode:
            options.valueColorMode ?? consoleDefaults.valueColorMode,
        writeToFile: options.writeToFile ?? false
    };
}

function captureStackTrace(message = CAPTURE_STACK_TRACE_MESSAGE): string {
    return new Error(message).stack ?? DEFAULT_STACK_TRACE;
}

function minimizeStackTrace(stackTrace: string): string {
    const lines = stackTrace.split(LINE_BREAK);

    if (lines.length <= STACK_TRACE_HEADER_LINE_COUNT) {
        return stackTrace;
    }

    const filteredLines = lines.filter((line, index) => {
        if (index === ROOT_STACK_TRACE_INDEX) {
            return true;
        }

        return !line.includes(NODE_MODULES_SEGMENT);
    });

    return filteredLines.join(LINE_BREAK);
}

function resolveStackTrace(stackTrace?: string): string {
    if (typeof stackTrace === "string") {
        return minimizeStackTrace(stackTrace);
    }

    return DEFAULT_STACK_TRACE;
}

function buildLogMessage(
    timestamp: string,
    levelLabel: string,
    loggerName: string,
    openTelemetryContextLabel: string,
    message: string
): string {
    return `${timestamp} ${levelLabel} [${loggerName}]${openTelemetryContextLabel} - ${message}`;
}

function formatOpenTelemetryContextLabel(
    openTelemetryContext?: OpenTelemetryContext
): string {
    if (
        typeof openTelemetryContext !== "object" ||
        openTelemetryContext.spanId.length === EMPTY_LENGTH ||
        openTelemetryContext.traceId.length === EMPTY_LENGTH
    ) {
        return "";
    }

    return ` [trace_id=${openTelemetryContext.traceId} span_id=${openTelemetryContext.spanId}]`;
}

/**
 * Reads the active span, when something has registered a reader.
 *
 * `@opentelemetry/api` used to be imported at the top of this module for one
 * call site. That made it unremovable for every consumer: the package registers
 * itself on `globalThis`, so a bundler must treat importing it as a side effect
 * and keep it even with `"sideEffects": false` and the option switched off. It
 * cost ~7 kB in browser bundles that can never have an active span.
 *
 * The reader is injected instead. `@murky-web/simplelog/otel` provides one;
 * nothing else in the package references OpenTelemetry, so it only ships where
 * it is asked for.
 */
type SpanContextReader = () => OpenTelemetryContext;

/**
 * Stands in until `/otel` registers a real one. Identity doubles as the
 * "nothing registered" check, which keeps the module free of a nullable.
 *
 * @returns {OpenTelemetryContext} Empty ids, the same value a disabled option
 *   produces.
 */
const NO_SPAN_CONTEXT_READER: SpanContextReader = () => {
    return EMPTY_OPEN_TELEMETRY_CONTEXT;
};

let spanContextReader: SpanContextReader = NO_SPAN_CONTEXT_READER;
let missingReaderWarned = false;

function setSpanContextReader(reader?: SpanContextReader): void {
    spanContextReader = reader ?? NO_SPAN_CONTEXT_READER;
}

function resolveOpenTelemetryContext(
    includeOpenTelemetryContext: boolean
): OpenTelemetryContext {
    if (!includeOpenTelemetryContext) {
        return EMPTY_OPEN_TELEMETRY_CONTEXT;
    }

    if (spanContextReader === NO_SPAN_CONTEXT_READER) {
        // Asking for span context without a reader used to work implicitly. Say so
        // once rather than silently logging empty ids forever.
        if (!missingReaderWarned) {
            missingReaderWarned = true;
            globalThis.console.warn(
                "[simplelog] includeOpenTelemetryContext is on but no reader is registered. " +
                    'Call enableOpenTelemetryContext() from "@murky-web/simplelog/otel" once at startup.'
            );
        }
        return EMPTY_OPEN_TELEMETRY_CONTEXT;
    }

    return spanContextReader();
}

function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[threshold];
}

class LoggerBase {
    private readonly LoggerConstructor: LoggerConstructor;
    private readonly includeOpenTelemetryContext: boolean;
    private readonly logLevelThreshold: LogLevel;
    private readonly name: string;
    private readonly output: LogOutput;
    private readonly parent?: LoggerParent | undefined;
    private readonly performanceBenchmarks = new Map<string, number>();
    private readonly runtime: LoggerRuntime;

    protected constructor(
        LoggerConstructor: LoggerConstructor,
        runtime: LoggerRuntime,
        name: string,
        parent?: LoggerParent,
        options: LoggerOptions = {}
    ) {
        this.LoggerConstructor = LoggerConstructor;
        this.includeOpenTelemetryContext =
            options.includeOpenTelemetryContext ?? false;
        this.logLevelThreshold = options.logLevelThreshold ?? DEFAULT_LOG_LEVEL;
        this.name = name;
        this.output = resolveLogOutput(name, options, runtime);
        this.parent = parent;
        this.runtime = runtime;
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

        this.log(
            "ERROR",
            assertionMessage,
            args,
            captureStackTrace(assertionMessage)
        );
    }

    public createChildLogger(
        name: string,
        otherLogger?: LoggerParent
    ): LoggerBase {
        if (typeof otherLogger === "object") {
            return new this.LoggerConstructor(
                name,
                this.mergeLoggers(otherLogger),
                this.getInheritedOptions()
            );
        }

        return new this.LoggerConstructor(
            name,
            this,
            this.getInheritedOptions()
        );
    }

    public debug(message: string, ...args: readonly unknown[]): void {
        this.log("DEBUG", message, args);
    }

    public endPerformanceBenchmark(label: string, message: string): void {
        const startTime = this.performanceBenchmarks.get(label);

        if (typeof startTime !== "number") {
            this.warn(
                `No start time found for performance test with label "${label}"`
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
            logLevelThreshold: this.logLevelThreshold,
            ...this.output
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
        stackTrace?: string
    ): void {
        if (!shouldLog(level, this.logLevelThreshold)) {
            return;
        }

        this.runtime.write(
            {
                args,
                epochMilliseconds: Date.now(),
                level,
                loggerName: this.getFullLoggerName(),
                message,
                openTelemetryContext: resolveOpenTelemetryContext(
                    this.includeOpenTelemetryContext
                ),
                stackTrace: resolveStackTrace(stackTrace)
            },
            this.output
        );
    }

    private mergeLoggers(otherLogger: LoggerParent): LoggerParent {
        return new this.LoggerConstructor(
            this.name,
            otherLogger,
            this.getInheritedOptions()
        );
    }
}

export {
    LoggerBase,
    buildLogMessage,
    createLoggerConsole,
    formatOpenTelemetryContextLabel,
    setSpanContextReader
};
export type {
    ConsoleDefaults,
    LogEntry,
    LogLevel,
    LogOutput,
    LogWriter,
    LoggerConsole,
    LoggerConstructor,
    LoggerOptions,
    LoggerParent,
    LoggerRuntime,
    OpenTelemetryContext,
    SpanContextReader,
    TimestampFormat,
    ValueColorMode
};
