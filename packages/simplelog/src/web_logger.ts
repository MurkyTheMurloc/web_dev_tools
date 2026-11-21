import { createTextLogWriter } from "./console_text";
import { LoggerBase, createLoggerConsole } from "./logger_factory";
import type {
    LoggerOptions,
    LoggerParent,
    LoggerRuntime,
    LogLevel
} from "./logger_factory";

// Servers and edge runtimes (Cloudflare, Netlify, Deno): text output with the
// serializer's safety rules. Browsers resolve `browser_logger` instead.
const webRuntime = {
    write: createTextLogWriter(createLoggerConsole())
} satisfies LoggerRuntime;

class Logger extends LoggerBase {
    constructor(
        name: string,
        parent?: LoggerParent,
        options: LoggerOptions = {}
    ) {
        super(Logger, webRuntime, name, parent, options);
    }
}

export { Logger };

export type { LoggerOptions, LogLevel };
