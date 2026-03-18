import { LoggerBase, createLoggerConsole } from "./logger_factory";
import type {
  LoggerOptions,
  LoggerParent,
  LoggerRuntime,
  LogLevel,
} from "./logger_factory";

const webRuntime = {
  console: createLoggerConsole(),
} satisfies LoggerRuntime;

class Logger extends LoggerBase {
  constructor(
    name: string,
    parent?: LoggerParent,
    options: LoggerOptions = {},
  ) {
    super(Logger, webRuntime, name, parent, options);
  }
}

export { Logger };

export type { LoggerOptions, LogLevel };
