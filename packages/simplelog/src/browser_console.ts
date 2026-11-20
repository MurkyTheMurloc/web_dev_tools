import { formatConsoleTimestamp } from "./console_timestamp";
import {
    buildLogMessage,
    formatOpenTelemetryContextLabel,
} from "./logger_factory";
import type { LoggerConsole, LogLevel, LogWriter } from "./logger_factory";
import { isError } from "./serialize_value";

const EMPTY_LENGTH = 0;
const FIRST_DEPTH = 0;
const DEPTH_STEP = 1;
const FIRST_INDEX = 0;
const MAX_ERROR_DEPTH = 8;
const MAX_AGGREGATED_ERRORS = 50;
const MAX_DEPTH_LABEL = "[MaxDepth]";
const OBJECT_LABEL = "[Object]";

// CSS colors for the header, close to the ANSI colors of the text writer and
// readable on the light and the dark DevTools theme.
const LEVEL_STYLES: Readonly<Record<LogLevel, string>> = {
    DEBUG: "color: #0891b2",
    ERROR: "color: #dc2626",
    INFO: "color: #16a34a",
    WARN: "color: #ca8a04",
};

function readString(value: object, key: string, fallback: string): string {
    const property: unknown = Reflect.get(value, key);

    if (typeof property === "string") {
        return property;
    }

    return fallback;
}

/**
 * Copies an Error with the text writer's allow-list only: `name`, `message`,
 * `stack`, `cause`, `code` (a string or a number) and, for an `AggregateError`,
 * `errors`. HTTP client errors (axios, got) carry the request, its headers and
 * its body in other properties. The copy is a real Error, so DevTools still
 * shows it with its stack.
 *
 * A `cause` or an element of `errors` is copied the same way when it is an
 * Error; any other object becomes a label, as in the text writer's
 * `serializeError`.
 *
 * @param {object} error - The Error.
 * @param {number} depth - How deep in the Error chain it sits.
 * @returns {unknown} The copy, or a label past the maximum depth.
 */
function copyError(error: object, depth: number): unknown {
    if (depth > MAX_ERROR_DEPTH) {
        return MAX_DEPTH_LABEL;
    }

    const copyChild = (value: unknown): unknown => {
        if (typeof value !== "object" || value === null) {
            return value;
        }

        if (!isError(value)) {
            return OBJECT_LABEL;
        }

        return copyError(value, depth + DEPTH_STEP);
    };
    const name = readString(error, "name", "Error");
    const copy = new Error(readString(error, "message", ""));
    const cause: unknown = Reflect.get(error, "cause");
    const code: unknown = Reflect.get(error, "code");
    const errors: unknown = Reflect.get(error, "errors");

    copy.name = name;
    copy.stack = readString(error, "stack", "");

    if (typeof cause !== "undefined") {
        copy.cause = copyChild(cause);
    }

    if (typeof code === "string" || typeof code === "number") {
        Reflect.set(copy, "code", code);
    }

    if (name === "AggregateError" && Array.isArray(errors)) {
        Reflect.set(
            copy,
            "errors",
            errors
                .slice(FIRST_INDEX, MAX_AGGREGATED_ERRORS)
                .map((entry: unknown) => {
                    return copyChild(entry);
                }),
        );
    }

    return copy;
}

function toConsoleArgument(argument: unknown): unknown {
    if (
        typeof argument === "object" &&
        argument !== null &&
        isError(argument)
    ) {
        return copyError(argument, FIRST_DEPTH);
    }

    return argument;
}

/**
 * The writer for browser DevTools. Arguments go to the console as they are, so
 * objects stay expandable and DevTools colors values itself. Only the header is
 * styled, with `%c` rather than ANSI codes, which Firefox does not render.
 *
 * The header is passed through `%s`, never as the format string itself: a `%`
 * in a message or logger name would otherwise be read as a format specifier.
 *
 * An Error argument is copied with the text writer's allow-list (`copyError`),
 * so a server bundle that resolves this writer by mistake does not print
 * request headers either. Errors nested inside other objects are not walked:
 * that needs the JSON serializer this writer leaves out.
 *
 * @param {LoggerConsole} loggerConsole - Where output goes.
 * @returns {LogWriter} The runtime's `write`.
 */
function createBrowserLogWriter(loggerConsole: LoggerConsole): LogWriter {
    return (entry, output) => {
        const header = buildLogMessage(
            formatConsoleTimestamp(
                entry.epochMilliseconds,
                output.timestampFormat,
            ),
            `[${entry.level}]`,
            entry.loggerName,
            formatOpenTelemetryContextLabel(entry.openTelemetryContext),
            entry.message,
        );
        const args = entry.args.map(toConsoleArgument);

        if (output.valueColorMode === "off") {
            loggerConsole.log("%s", header, ...args);
        } else {
            loggerConsole.log(
                "%c%s",
                LEVEL_STYLES[entry.level],
                header,
                ...args,
            );
        }

        if (entry.stackTrace.length > EMPTY_LENGTH) {
            loggerConsole.error(entry.stackTrace);
        }
    };
}

export { createBrowserLogWriter };
