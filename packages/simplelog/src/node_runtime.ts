import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

import { resolveConsoleDefaults } from "./console_defaults";
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
        stdoutIsTerminal: process.stdout.isTTY,
    });
}

const nodeRuntime = {
    appendTextFileSync(filePath: string, content: string): void {
        ensureParentDirectoryExists(filePath);
        appendFileSync(filePath, content, LOG_FILE_ENCODING);
    },
    console: createLoggerConsole(),
    readConsoleDefaults: readNodeConsoleDefaults,
} satisfies LoggerRuntime;

export { nodeRuntime };
