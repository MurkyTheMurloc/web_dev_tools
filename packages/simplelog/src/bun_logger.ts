import { nodeRuntime as bunRuntime } from "./node_runtime";
import { LoggerBase } from "./logger_factory";
import type { LoggerOptions, LoggerParent, LogLevel } from "./logger_factory";

class Logger extends LoggerBase {
  constructor(
    name: string,
    parent?: LoggerParent,
    options: LoggerOptions = {},
  ) {
    super(Logger, bunRuntime, name, parent, options);
  }
}

export { Logger };

export type { LoggerOptions, LogLevel };
