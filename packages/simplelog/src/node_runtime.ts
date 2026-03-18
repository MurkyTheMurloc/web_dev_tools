import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createLoggerConsole } from "./logger_factory";
import type { LoggerRuntime } from "./logger_factory";

const LOG_FILE_ENCODING = "utf8";

function ensureParentDirectoryExists(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

const nodeRuntime = {
  appendTextFileSync(filePath: string, content: string): void {
    ensureParentDirectoryExists(filePath);
    appendFileSync(filePath, content, LOG_FILE_ENCODING);
  },
  console: createLoggerConsole(),
} satisfies LoggerRuntime;

export { nodeRuntime };
