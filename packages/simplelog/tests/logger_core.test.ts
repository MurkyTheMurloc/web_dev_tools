import { trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoggerBase } from "../src/logger_factory";
import {
    disableOpenTelemetryContext,
    enableOpenTelemetryContext,
} from "../src/otel";
import type {
    LoggerOptions,
    LoggerParent,
    LoggerRuntime,
} from "../src/logger_factory";

const NUM_0 = 0;
const NUM_1 = 1;
const NUM_2 = 2;
const NUM_3 = 3;
const NUM_4 = 4;
const NUM_42 = 42;
const NUM_5 = 5;
const NUM_6 = 6;

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

type TestRuntime = Readonly<{
    consoleCalls: LogCall[];
    fileCalls: FileCall[];
    runtime: LoggerRuntime;
}>;

function argumentText(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value);
}

function noop(): void {
    // intentionally empty
}

function createTestRuntime(): TestRuntime {
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
    return trace.wrapSpanContext({
        spanId: "0123456789abcdef",
        traceFlags: NUM_1,
        traceId: "0123456789abcdef0123456789abcdef",
    });
}

function namedHelper(): string {
    return "named";
}

function resetLoggerState(): void {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // The reader is module state; leaving one registered would make the
    // "no reader" case pass for the wrong reason.
    disableOpenTelemetryContext();
}

describe(LoggerBase, () => {
    beforeEach(resetLoggerState);

    it("suppresses messages below the configured threshold", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "audit", undefined, {
            logLevelThreshold: "WARN",
        });

        logger.info("not visible");
        logger.warn("visible");

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(consoleCalls[NUM_0]?.type).toBe("log");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain("[WARN]");
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

        expect(fileCalls).toHaveLength(NUM_1);
        expect(fileCalls[NUM_0]?.filePath).toBe("/tmp/simplelog/parent.log");
        expect(fileCalls[NUM_0]?.content).toContain("parent -> child");
    });

    it("warns when a performance benchmark is ended without a start", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "perf");

        logger.endPerformanceBenchmark("missing", "done");

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain("[WARN]");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain(
            "No start time found",
        );
    });
});

describe("LoggerBase console colors", () => {
    beforeEach(resetLoggerState);

    it("colorizes additional console arguments and keeps file output plain", () => {
        const { consoleCalls, fileCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "colors", undefined, {
            logFilePath: "/tmp/simplelog/colors.log",
            writeToFile: true,
        });

        logger.info("headline", "part-one", "part-two");

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain("\u001B[32m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_1])).toContain("\u001B[32m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_2])).toContain("\u001B[32m");
        expect(fileCalls).toHaveLength(NUM_1);
        expect(fileCalls[NUM_0]?.content).toContain("[INFO]");
        expect(fileCalls[NUM_0]?.content).not.toContain("\u001B[");
    });

    it("supports syntax highlighting for different value kinds", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "syntax", undefined, {
            valueColorMode: "syntax",
        });

        logger.info("typed", "text", NUM_42, false, null, Symbol("token"), {
            ok: true,
        });

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_1])).toContain("\u001B[32m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_2])).toContain("\u001B[36m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_3])).toContain("\u001B[33m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_4])).toContain("\u001B[90m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_5])).toContain("\u001B[35m");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_6])).toContain("\u001B[34m");
    });

    it("supports fully plain console output", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "plain", undefined, {
            valueColorMode: "off",
        });

        logger.info("headline", "part-one");

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).not.toContain("\u001B[");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_1])).not.toContain("\u001B[");
    });
});

describe("LoggerBase structured output and assertions", () => {
    beforeEach(resetLoggerState);

    it("serializes functions nested inside structured log arguments", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "structured", undefined, {
            valueColorMode: "off",
        });

        logger.info("payload", {
            callback: namedHelper,
            nested: {
                inner: namedHelper,
            },
            values: [
                (): string => {
                    return "anonymous";
                },
            ],
        });

        const payload = argumentText(consoleCalls[NUM_0]?.args[NUM_1]);

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(payload).toContain("[Function namedHelper]");
        expect(payload).toContain("[Function anonymous]");
    });

    it("logs assertion failures with a stack trace", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "assertions");

        logger.assert(false, "broken", { detail: "payload" });

        expect(consoleCalls).toHaveLength(NUM_2);
        expect(consoleCalls[NUM_0]?.type).toBe("log");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain("[ERROR]");
        expect(consoleCalls[NUM_1]?.type).toBe("error");
        expect(argumentText(consoleCalls[NUM_1]?.args[NUM_0])).toContain(
            "Assertion failed",
        );
    });
});

describe("LoggerBase OpenTelemetry context", () => {
    beforeEach(resetLoggerState);

    it("includes active OpenTelemetry trace context when enabled", () => {
        const { consoleCalls, fileCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "otel", undefined, {
            includeOpenTelemetryContext: true,
            logFilePath: "/tmp/simplelog/otel.log",
            writeToFile: true,
        });
        const activeSpan = createTestSpan();
        vi.spyOn(trace, "getActiveSpan").mockReturnValue(activeSpan);
        // The option alone no longer reaches OpenTelemetry: the factory holds an
        // injected reader, and `/otel` is what supplies one.
        enableOpenTelemetryContext();

        logger.info("correlated");

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain("trace_id=");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).toContain("span_id=");
        expect(fileCalls).toHaveLength(NUM_1);
        expect(fileCalls[NUM_0]?.content).toContain("trace_id=");
        expect(fileCalls[NUM_0]?.content).toContain("span_id=");
    });

    it("logs empty context and warns once when no reader is registered", () => {
        const warn = vi.spyOn(globalThis.console, "warn").mockImplementation(noop);
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "otel-unwired", undefined, {
            includeOpenTelemetryContext: true,
        });
        vi.spyOn(trace, "getActiveSpan").mockReturnValue(createTestSpan());

        logger.info("correlated");

        // Silently logging empty ids would look like working span correlation.
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).not.toContain("trace_id=");
        expect(warn).toHaveBeenCalledTimes(NUM_1);
        expect(argumentText(warn.mock.calls[NUM_0]?.[NUM_0])).toContain(
            "@murky-web/simplelog/otel",
        );
    });

    it("skips OpenTelemetry context when disabled", () => {
        const { consoleCalls, runtime } = createTestRuntime();
        const logger = new TestLogger(runtime, "otel-off");
        const activeSpan = createTestSpan();
        const getActiveSpanSpy = vi
            .spyOn(trace, "getActiveSpan")
            .mockReturnValue(activeSpan);

        logger.info("uncorrelated");

        expect(consoleCalls).toHaveLength(NUM_1);
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).not.toContain("trace_id=");
        expect(argumentText(consoleCalls[NUM_0]?.args[NUM_0])).not.toContain("span_id=");
        expect(getActiveSpanSpy).not.toHaveBeenCalled();
    });
});
