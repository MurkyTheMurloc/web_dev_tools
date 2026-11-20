import { createBrowserLogWriter } from "./browser_console";
import { LoggerBase, createLoggerConsole } from "./logger_factory";
import type {
    LoggerOptions,
    LoggerParent,
    LoggerRuntime,
    LogLevel,
} from "./logger_factory";

/**
 * What `@murky-web/simplelog/web` resolves to under the `browser` export
 * condition. Same API as the `web` logger; see `createBrowserLogWriter` for how
 * the output differs.
 */
const browserRuntime = {
    write: createBrowserLogWriter(createLoggerConsole()),
} satisfies LoggerRuntime;

class Logger extends LoggerBase {
    constructor(
        name: string,
        parent?: LoggerParent,
        options: LoggerOptions = {},
    ) {
        super(Logger, browserRuntime, name, parent, options);
    }
}

export { Logger };

export type { LoggerOptions, LogLevel };
