import type { StringifiedArgument } from "./console_text";
import {
    buildLogMessage,
    formatOpenTelemetryContextLabel,
} from "./logger_factory";
import type { LogEntry } from "./logger_factory";
import { escapeFileCharacters } from "./serialize_value";

const LINE_BREAK = "\n";
const ARGUMENT_SEPARATOR = " ";
const STACK_CONTINUATION_PREFIX = "\t";
const EMPTY_LENGTH = 0;

/** A log entry with its arguments already turned into text. */
type LogFileEntry = Readonly<
    Omit<LogEntry, "args"> & {
        args: readonly StringifiedArgument[];
    }
>;

type LogFileWriter = (filePath: string, entry: LogFileEntry) => void;

function formatFileArgument(argument: StringifiedArgument): string {
    // Objects use their compact, single-line JSON. JSON already escaped the
    // control characters below U+0020; the rest (DEL, C1, U+2028, bidi
    // controls) is escaped here, and an escape inside a JSON string is still
    // valid JSON.
    if (argument.kind === "object" && "jsonValue" in argument) {
        return escapeFileCharacters(JSON.stringify(argument.jsonValue));
    }

    return escapeFileCharacters(argument.text);
}

/**
 * The file line is the console line without colors and with the ISO timestamp:
 * the header, then every argument, separated by a space the way `console.log`
 * separates them.
 *
 * @param {LogFileEntry} entry - The log call.
 * @returns {string} One log file line, without the trailing line break.
 */
function buildFileLine(entry: LogFileEntry): string {
    const header = escapeFileCharacters(
        buildLogMessage(
            new Date(entry.epochMilliseconds).toISOString(),
            `[${entry.level}]`,
            entry.loggerName,
            formatOpenTelemetryContextLabel(entry.openTelemetryContext),
            entry.message,
        ),
    );

    return [header, ...entry.args.map(formatFileArgument)].join(
        ARGUMENT_SEPARATOR,
    );
}

/**
 * A stack trace is several lines. Every one of them starts with a tab in the
 * file, while every log entry starts with a timestamp, so a reader can tell the
 * continuation lines of an entry from the next entry.
 *
 * @param {string} stackTrace - The plain stack trace.
 * @returns {string} The stack trace, each line tab-prefixed and escaped.
 */
function formatFileStackTrace(stackTrace: string): string {
    return stackTrace
        .split(LINE_BREAK)
        .map((line) => {
            return `${STACK_CONTINUATION_PREFIX}${escapeFileCharacters(line)}`;
        })
        .join(LINE_BREAK);
}

/**
 * The log file writer for runtimes that can append to a file. Only those import
 * this module, so the `web` entry never bundles it.
 *
 * @param {(filePath: string, content: string) => void} appendTextFileSync -
 *   Appends text to the file, creating it when it is missing.
 * @returns {LogFileWriter} Writes one entry, then its stack trace, if any.
 */
function createLogFileWriter(
    appendTextFileSync: (filePath: string, content: string) => void,
): LogFileWriter {
    return (filePath, entry) => {
        appendTextFileSync(filePath, `${buildFileLine(entry)}${LINE_BREAK}`);

        if (entry.stackTrace.length > EMPTY_LENGTH) {
            appendTextFileSync(
                filePath,
                `${formatFileStackTrace(entry.stackTrace)}${LINE_BREAK}`,
            );
        }
    };
}

export { createLogFileWriter };
export type { LogFileEntry, LogFileWriter };
