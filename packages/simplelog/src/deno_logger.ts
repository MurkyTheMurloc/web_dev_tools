import { LoggerBase, createLoggerConsole } from "./logger_factory";
import type {
  LoggerOptions,
  LoggerParent,
  LoggerRuntime,
  LogLevel,
} from "./logger_factory";

type DenoOpenOptions = Readonly<{
  append?: boolean;
  create?: boolean;
  write?: boolean;
}>;

type DenoApi = Readonly<{
  mkdirSync: (
    path: string,
    options: Readonly<{
      recursive?: boolean;
    }>,
  ) => void;
  writeTextFileSync: (
    path: string,
    data: string,
    options: DenoOpenOptions,
  ) => void;
}>;

const ROOT_DIRECTORY_INDEX = 0;

function getDirectoryPath(filePath: string): string {
  const lastSlashIndex = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );

  if (lastSlashIndex <= ROOT_DIRECTORY_INDEX) {
    return ".";
  }

  return filePath.slice(ROOT_DIRECTORY_INDEX, lastSlashIndex);
}

function isDenoApi(runtime: unknown): runtime is DenoApi {
  if (typeof runtime !== "object" || runtime === null) {
    return false;
  }

  return (
    "mkdirSync" in runtime &&
    typeof Reflect.get(runtime, "mkdirSync") === "function" &&
    "writeTextFileSync" in runtime &&
    typeof Reflect.get(runtime, "writeTextFileSync") === "function"
  );
}

function getDenoRuntime(): DenoApi {
  const denoCandidate: unknown = Reflect.get(globalThis, "Deno");

  if (!isDenoApi(denoCandidate)) {
    throw new Error("The Deno logger requires the Deno runtime.");
  }

  return denoCandidate;
}

function appendWithDeno(filePath: string, content: string): void {
  const denoRuntime = getDenoRuntime();

  denoRuntime.mkdirSync(getDirectoryPath(filePath), { recursive: true });
  denoRuntime.writeTextFileSync(filePath, content, {
    append: true,
    create: true,
    write: true,
  });
}

const denoRuntime = {
  appendTextFileSync: appendWithDeno,
  console: createLoggerConsole(),
} satisfies LoggerRuntime;

class Logger extends LoggerBase {
  constructor(
    name: string,
    parent?: LoggerParent,
    options: LoggerOptions = {},
  ) {
    super(Logger, denoRuntime, name, parent, options);
  }
}

export { Logger };

export type { LoggerOptions, LogLevel };
