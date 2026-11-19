import type {
    ConsoleDefaults,
    TimestampFormat,
    ValueColorMode,
} from "./logger_factory";

/**
 * What a runtime knows about where its console output goes, read raw from the
 * environment. The Node and Bun runtime fills it in; this module turns it into
 * defaults and never touches `process` itself, so it stays safe for the
 * browser build.
 */
type ConsoleEnvironment = Readonly<{
    forceColor: string | undefined;
    noColor: string | undefined;
    simplelogTimestamp: string | undefined;
    stdoutIsTerminal: boolean;
}>;

const FORCE_COLOR_DISABLED = new Set(["0", "false"]);

/**
 * `NO_COLOR` as https://no-color.org defines it wins, then `FORCE_COLOR` with
 * Node's values (`0` and `false` mean off, anything else, even empty, means
 * on), then whether stdout is a terminal.
 *
 * @param {ConsoleEnvironment} environment - The raw environment.
 * @returns {ValueColorMode} `"level"` for colors, `"off"` for plain text.
 */
function resolveDefaultValueColorMode(
    environment: ConsoleEnvironment,
): ValueColorMode {
    if (typeof environment.noColor === "string" && environment.noColor !== "") {
        return "off";
    }

    if (typeof environment.forceColor === "string") {
        if (FORCE_COLOR_DISABLED.has(environment.forceColor)) {
            return "off";
        }

        return "level";
    }

    if (environment.stdoutIsTerminal) {
        return "level";
    }

    return "off";
}

function parseTimestampFormat(
    value: string | undefined,
): TimestampFormat | undefined {
    if (value === "iso" || value === "time") {
        return value;
    }

    return undefined;
}

/**
 * The time of day is enough to read along in a terminal; a pipe usually ends in
 * a file, CI or a log service, where the date is needed. `SIMPLELOG_TIMESTAMP`
 * overrides that for pipes that are read by people (a process manager's TUI).
 *
 * @param {ConsoleEnvironment} environment - The raw environment.
 * @returns {TimestampFormat} The console timestamp format.
 */
function resolveDefaultTimestampFormat(
    environment: ConsoleEnvironment,
): TimestampFormat {
    const override = parseTimestampFormat(environment.simplelogTimestamp);

    if (override !== undefined) {
        return override;
    }

    if (environment.stdoutIsTerminal) {
        return "time";
    }

    return "iso";
}

function resolveConsoleDefaults(
    environment: ConsoleEnvironment,
): ConsoleDefaults {
    return {
        timestampFormat: resolveDefaultTimestampFormat(environment),
        valueColorMode: resolveDefaultValueColorMode(environment),
    };
}

export { resolveConsoleDefaults };
export type { ConsoleEnvironment };
