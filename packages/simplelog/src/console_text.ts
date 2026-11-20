import { formatConsoleTimestamp } from "./console_timestamp";
import type { LogFileWriter } from "./log_file";
import {
    buildLogMessage,
    formatOpenTelemetryContextLabel,
} from "./logger_factory";
import type {
    LogEntry,
    LoggerConsole,
    LogLevel,
    LogOutput,
    LogWriter,
    OpenTelemetryContext,
    ValueColorMode,
} from "./logger_factory";
import { formatFunctionLabel, toJsonSafeValue } from "./serialize_value";

const ANSI_RESET_COLOR = 0;
const ANSI_GREEN = 32;
const ANSI_YELLOW = 33;
const ANSI_RED = 31;
const ANSI_CYAN = 36;
const ANSI_BLUE = 34;
const ANSI_MAGENTA = 35;
const ANSI_GRAY = 90;
const EMPTY_LENGTH = 0;
const JSON_INDENTATION = 2;
const FALLBACK_OBJECT_STRING = "[Object]";

type ConsolePayload = Readonly<{
    consoleArgs: readonly string[];
    consoleLogMessage: string;
    consoleStackTrace: string;
}>;

type StringifiablePrimitive = bigint | boolean | number | string | symbol;

type StringifiedArgument = Readonly<{
    /**
     * The JSON-safe value behind an object's `text`. The log file writes it as
     * compact JSON; it is only serialized again when a file is written.
     */
    jsonValue?: unknown;
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

function colorize(text: string, colorCode: number): string {
    return `\u001B[${colorCode}m${text}\u001B[${ANSI_RESET_COLOR}m`;
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

function stringifyPrimitiveArgument(
    argument: StringifiablePrimitive,
): StringifiedArgument {
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
    return {
        kind: "function",
        text: formatFunctionLabel(functionName),
    };
}

function stringifyJsonArgument(argument: unknown): StringifiedArgument {
    try {
        const safeValue = toJsonSafeValue(argument);
        const stringifiedArgument = JSON.stringify(
            safeValue,
            undefined,
            JSON_INDENTATION,
        );

        if (typeof stringifiedArgument !== "string") {
            return {
                kind: "object",
                text: FALLBACK_OBJECT_STRING,
            };
        }

        return {
            jsonValue: safeValue,
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

function colorizeOpenTelemetryContextLabel(
    level: LogLevel,
    openTelemetryContext: OpenTelemetryContext | undefined,
    valueColorMode: ValueColorMode,
): string {
    const plainOpenTelemetryContextLabel =
        formatOpenTelemetryContextLabel(openTelemetryContext);

    if (
        valueColorMode === "off" ||
        plainOpenTelemetryContextLabel.length === EMPTY_LENGTH
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
    entry: LogEntry,
    args: readonly StringifiedArgument[],
    output: LogOutput,
): ConsolePayload {
    const { level } = entry;
    const { valueColorMode } = output;

    return {
        consoleArgs: colorizeArguments(args, level, valueColorMode),
        consoleLogMessage: buildConsoleLogMessage(
            level,
            formatConsoleTimestamp(
                entry.epochMilliseconds,
                output.timestampFormat,
            ),
            entry.loggerName,
            entry.openTelemetryContext,
            entry.message,
            valueColorMode,
        ),
        consoleStackTrace: buildConsoleStackTrace(
            entry.stackTrace,
            level,
            valueColorMode,
        ),
    };
}

/**
 * The writer for terminals and server logs: every argument is turned into text
 * (objects as JSON, with the safety rules of `toJsonSafeValue`), colored with
 * ANSI codes unless `valueColorMode` is `"off"`.
 *
 * @param {LoggerConsole} loggerConsole - Where console output goes.
 * @param {LogFileWriter} [writeLogFile] - Writes the log file; only runtimes
 *   that can write files pass one.
 * @returns {LogWriter} The runtime's `write`.
 */
function createTextLogWriter(
    loggerConsole: LoggerConsole,
    writeLogFile?: LogFileWriter,
): LogWriter {
    return (entry, output) => {
        const args = stringifyArguments(entry.args);

        if (output.writeToFile && typeof writeLogFile === "function") {
            writeLogFile(output.logFilePath, { ...entry, args });
        }

        const payload = createConsolePayload(entry, args, output);

        loggerConsole.log(payload.consoleLogMessage, ...payload.consoleArgs);
        if (entry.stackTrace.length > EMPTY_LENGTH) {
            loggerConsole.error(payload.consoleStackTrace);
        }
    };
}

export { createTextLogWriter };
export type { StringifiedArgument };
