import { beforeEach, describe, expect, it, vi } from "vitest";
import { trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

import { LoggerBase } from "../src/logger_factory";
import type {
  LoggerOptions,
  LoggerParent,
  LoggerRuntime,
} from "../src/logger_factory";

type LogCall = Readonly<{
  args: readonly unknown[];
  type: "error" | "log";
}>;

type FileCall = Readonly<{
  content: string;
  filePath: string;
}>;

class TestLogger extends LoggerBase {
  constructor(
    runtime: LoggerRuntime,
    name: string,
    parent?: LoggerParent,
    options: LoggerOptions = {},
  ) {
    super(TestLogger.bind(null, runtime), runtime, name, parent, options);
  }
}

function createTestRuntime() {
  const consoleCalls: LogCall[] = [];
  const fileCalls: FileCall[] = [];

  const runtime = {
    appendTextFileSync(filePath: string, content: string): void {
      fileCalls.push({ content, filePath });
    },
    console: {
      error(...args: readonly unknown[]): void {
        consoleCalls.push({ args, type: "error" });
      },
      log(...args: readonly unknown[]): void {
        consoleCalls.push({ args, type: "log" });
      },
    },
  } satisfies LoggerRuntime;

  return { consoleCalls, fileCalls, runtime };
}

function createTestSpan(): Span {
  return {
    spanContext() {
      return {
        spanId: "0123456789abcdef",
        traceFlags: 1,
        traceId: "0123456789abcdef0123456789abcdef",
      };
    },
  } as unknown as Span;
}

describe("LoggerBase", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("suppresses messages below the configured threshold", () => {
    const { consoleCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "audit", undefined, {
      logLevelThreshold: "WARN",
    });

    logger.info("not visible");
    logger.warn("visible");

    expect(consoleCalls).toHaveLength(1);
    expect(consoleCalls[0]?.type).toBe("log");
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("[WARN]");
  });

  it("inherits parent options in child loggers", () => {
    const { fileCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "parent", undefined, {
      logFilePath: "/tmp/simplelog/parent.log",
      logLevelThreshold: "WARN",
      writeToFile: true,
    });
    const childLogger = logger.createChildLogger("child");

    childLogger.info("hidden");
    childLogger.warn("persisted");

    expect(fileCalls).toHaveLength(1);
    expect(fileCalls[0]?.filePath).toBe("/tmp/simplelog/parent.log");
    expect(fileCalls[0]?.content).toContain("parent -> child");
  });

  it("warns when a performance benchmark is ended without a start", () => {
    const { consoleCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "perf");

    logger.endPerformanceBenchmark("missing", "done");

    expect(consoleCalls).toHaveLength(1);
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("[WARN]");
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("No start time found");
  });

  it("colorizes additional console arguments and keeps file output plain", () => {
    const { consoleCalls, fileCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "colors", undefined, {
      logFilePath: "/tmp/simplelog/colors.log",
      writeToFile: true,
    });

    logger.info("headline", "part-one", "part-two");

    expect(consoleCalls).toHaveLength(1);
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("\u001B[32m");
    expect(`${consoleCalls[0]?.args[1] ?? ""}`).toContain("\u001B[32m");
    expect(`${consoleCalls[0]?.args[2] ?? ""}`).toContain("\u001B[32m");
    expect(fileCalls).toHaveLength(1);
    expect(fileCalls[0]?.content).toContain("[INFO]");
    expect(fileCalls[0]?.content).not.toContain("\u001B[");
  });

  it("supports syntax highlighting for different value kinds", () => {
    const { consoleCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "syntax", undefined, {
      valueColorMode: "syntax",
    });

    logger.info("typed", "text", 42, false, null, Symbol("token"), {
      ok: true,
    });

    expect(consoleCalls).toHaveLength(1);
    expect(`${consoleCalls[0]?.args[1] ?? ""}`).toContain("\u001B[32m");
    expect(`${consoleCalls[0]?.args[2] ?? ""}`).toContain("\u001B[36m");
    expect(`${consoleCalls[0]?.args[3] ?? ""}`).toContain("\u001B[33m");
    expect(`${consoleCalls[0]?.args[4] ?? ""}`).toContain("\u001B[90m");
    expect(`${consoleCalls[0]?.args[5] ?? ""}`).toContain("\u001B[35m");
    expect(`${consoleCalls[0]?.args[6] ?? ""}`).toContain("\u001B[34m");
  });

  it("supports fully plain console output", () => {
    const { consoleCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "plain", undefined, {
      valueColorMode: "off",
    });

    logger.info("headline", "part-one");

    expect(consoleCalls).toHaveLength(1);
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).not.toContain("\u001B[");
    expect(`${consoleCalls[0]?.args[1] ?? ""}`).not.toContain("\u001B[");
  });

  it("includes active OpenTelemetry trace context when enabled", () => {
    const { consoleCalls, fileCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "otel", undefined, {
      includeOpenTelemetryContext: true,
      logFilePath: "/tmp/simplelog/otel.log",
      writeToFile: true,
    });
    const activeSpan = createTestSpan();
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(activeSpan);

    logger.info("correlated");

    expect(consoleCalls).toHaveLength(1);
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("trace_id=");
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("span_id=");
    expect(fileCalls).toHaveLength(1);
    expect(fileCalls[0]?.content).toContain("trace_id=");
    expect(fileCalls[0]?.content).toContain("span_id=");
  });

  it("skips OpenTelemetry context when disabled", () => {
    const { consoleCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "otel-off");
    const activeSpan = createTestSpan();
    const getActiveSpanSpy = vi
      .spyOn(trace, "getActiveSpan")
      .mockReturnValue(activeSpan);

    logger.info("uncorrelated");

    expect(consoleCalls).toHaveLength(1);
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).not.toContain("trace_id=");
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).not.toContain("span_id=");
    expect(getActiveSpanSpy).not.toHaveBeenCalled();
  });

  it("logs assertion failures with a stack trace", () => {
    const { consoleCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, "assertions");

    logger.assert(false, "broken", { detail: "payload" });

    expect(consoleCalls).toHaveLength(2);
    expect(consoleCalls[0]?.type).toBe("log");
    expect(`${consoleCalls[0]?.args[0] ?? ""}`).toContain("[ERROR]");
    expect(consoleCalls[1]?.type).toBe("error");
    expect(`${consoleCalls[1]?.args[0] ?? ""}`).toContain("Assertion failed");
  });
});
