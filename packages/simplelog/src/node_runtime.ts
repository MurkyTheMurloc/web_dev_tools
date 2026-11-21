import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

import { resolveConsoleDefaults } from "./console_defaults";
import { createTextLogWriter } from "./console_text";
import { createLogFileWriter } from "./log_file";
import { createLoggerConsole } from "./logger_factory";
import type { ConsoleDefaults, LoggerRuntime } from "./logger_factory";

const LOG_FILE_ENCODING = "utf8";

function ensureParentDirectoryExists(filePath: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
}

function readNodeConsoleDefaults(): ConsoleDefaults {
    return resolveConsoleDefaults({
        forceColor: process.env.FORCE_COLOR,
        noColor: process.env.NO_COLOR,
        simplelogTimestamp: process.env.SIMPLELOG_TIMESTAMP,
        stdoutIsTerminal: process.stdout.isTTY
    });
}

const nodeRuntime = {
    readConsoleDefaults: readNodeConsoleDefaults,
    write: createTextLogWriter(
        createLoggerConsole(),
        createLogFileWriter((filePath, content) => {
            ensureParentDirectoryExists(filePath);
            appendFileSync(filePath, content, LOG_FILE_ENCODING);
        })
    )
} satisfies LoggerRuntime;

export { nodeRuntime };
