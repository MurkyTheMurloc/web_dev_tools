import { trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";
import { runInNewContext } from "node:vm";
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
const NUM_1000 = 1000;

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

function createFileLogger(name: string): Readonly<{
    fileCalls: FileCall[];
    consoleCalls: LogCall[];
    logger: TestLogger;
}> {
    const { consoleCalls, fileCalls, runtime } = createTestRuntime();
    const logger = new TestLogger(runtime, name, undefined, {
        logFilePath: `/tmp/simplelog/${name}.log`,
        valueColorMode: "off",
        writeToFile: true,
    });

    return { consoleCalls, fileCalls, logger };
}

function loggedArgument(calls: readonly LogCall[], index: number): string {
    return argumentText(calls[NUM_0]?.args[index]);
}

describe("LoggerBase file output arguments", () => {
    beforeEach(resetLoggerState);

    it("writes the plain log arguments into the file line", () => {
        const { fileCalls, logger } = createFileLogger("file-args");

        logger.info("user login", { userId: NUM_42 }, "extra", NUM_5, null);

        expect(fileCalls).toHaveLength(NUM_1);
        expect(fileCalls[NUM_0]?.content).toContain(
            '- user login {"userId":42} extra 5 null\n',
        );
        expect(fileCalls[NUM_0]?.content).not.toContain("\u001B[");
    });

    it("writes objects as compact single-line JSON and keeps the console pretty", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("file-json");

        logger.info("nested", { list: [NUM_1, { deep: true }], text: "a\nb" });

        const content = fileCalls[NUM_0]?.content ?? "";

        expect(content.split("\n")).toHaveLength(NUM_2);
        expect(content).toContain('{"list":[1,{"deep":true}],"text":"a\\nb"}');
        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"list": [');
    });

    it("writes no trailing separator when there are no arguments", () => {
        const { fileCalls, logger } = createFileLogger("file-no-args");

        logger.info("bare");

        expect(fileCalls[NUM_0]?.content.endsWith("- bare\n")).toBeTruthy();
    });
});

describe("LoggerBase structured argument serialization", () => {
    beforeEach(resetLoggerState);

    it("serializes Error arguments with name, message, stack and cause", () => {
        const { consoleCalls, logger } = createFileLogger("errors");
        const failure = new Error("boom", {
            cause: new TypeError("inner failure"),
        });

        logger.info("failed", failure);

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain('"name": "Error"');
        expect(text).toContain('"message": "boom"');
        expect(text).toContain('"stack": "Error: boom');
        expect(text).toContain('"name": "TypeError"');
        expect(text).toContain('"message": "inner failure"');
    });

    it("keeps a string or number code of an Error and drops other properties", () => {
        const { consoleCalls, logger } = createFileLogger("error-props");

        logger.info(
            "failed",
            Object.assign(new Error("denied"), { code: "E_DENIED" }),
            Object.assign(new Error("exit"), { code: NUM_42 }),
            Object.assign(new Error("odd"), { code: { nested: "secret-code" } }),
        );

        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"code": "E_DENIED"');
        expect(loggedArgument(consoleCalls, NUM_2)).toContain('"code": 42');
        expect(loggedArgument(consoleCalls, NUM_3)).not.toContain("code");
        expect(loggedArgument(consoleCalls, NUM_3)).not.toContain("secret-code");
    });

    it("leaks no credentials from an HTTP client error, on console and file", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("axios-like");
        const failure = Object.assign(new Error("Request failed with status 401"), {
            code: "ERR_BAD_REQUEST",
            config: {
                auth: { password: "pw-s3cret" },
                data: "body-s3cret",
                headers: { Authorization: "Bearer token-s3cret" },
            },
            options: { headers: { cookie: "cookie-s3cret" } },
            request: {
                _header: "GET / HTTP/1.1\r\nAuthorization: Bearer token-s3cret\r\n",
            },
            response: {
                data: "response-s3cret",
                headers: { "set-cookie": ["sid=set-cookie-s3cret"] },
            },
        });

        logger.error("upstream failed", failure);

        const consoleText = JSON.stringify(consoleCalls);
        const fileText = fileCalls
            .map((call) => {
                return call.content;
            })
            .join("");

        for (const text of [consoleText, fileText]) {
            expect(text).not.toContain("s3cret");
            expect(text).not.toContain("Authorization");
            expect(text).toContain("Request failed with status 401");
            expect(text).toContain("ERR_BAD_REQUEST");
        }
    });

    it("serializes the errors of an AggregateError and nothing else", () => {
        const { consoleCalls, logger } = createFileLogger("aggregate");
        const failure = Object.assign(
            new AggregateError(
                [
                    new TypeError("first failure"),
                    Object.assign(new Error("second failure"), {
                        config: { token: "token-s3cret" },
                    }),
                ],
                "several failed",
            ),
            { extra: "extra-s3cret" },
        );

        logger.info("failed", failure);

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain('"name": "AggregateError"');
        expect(text).toContain('"errors": [');
        expect(text).toContain('"message": "first failure"');
        expect(text).toContain('"message": "second failure"');
        expect(text).not.toContain("s3cret");
    });

    it("prints a non-Error cause as a label, not its contents", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("cause-leak");

        logger.info(
            "failed",
            new Error("upstream", {
                cause: { config: { headers: { Authorization: "Bearer cause-s3cret" } } },
            }),
            new Error("wrapped", {
                cause: Object.assign(new Error("inner"), { config: { token: "t-s3cret" } }),
            }),
            new Error("text cause", { cause: "plain reason" }),
        );

        const everything = `${JSON.stringify(consoleCalls)}${fileCalls[NUM_0]?.content}`;

        expect(everything).not.toContain("s3cret");
        expect(everything).not.toContain("Authorization");
        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"cause": "[Object]"');
        expect(loggedArgument(consoleCalls, NUM_2)).toContain('"message": "inner"');
        expect(loggedArgument(consoleCalls, NUM_3)).toContain('"cause": "plain reason"');
    });

    it("prints only Errors and primitives of an AggregateError in full", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("aggregate-leak");

        logger.info(
            "failed",
            new AggregateError(
                [
                    { headers: { Authorization: "Bearer agg-s3cret" } },
                    new TypeError("real error"),
                    "just text",
                ],
                "several",
            ),
        );

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(`${text}${fileCalls[NUM_0]?.content}`).not.toContain("s3cret");
        expect(text).toContain('"[Object]"');
        expect(text).toContain('"message": "real error"');
        expect(text).toContain('"just text"');
    });

    it("recognises an Error from another realm", () => {
        const { consoleCalls, logger } = createFileLogger("realm");
        const foreign: unknown = runInNewContext(
            "Object.assign(new Error('from elsewhere'), { secret: 'realm-s3cret' })",
        );

        logger.info("failed", foreign);

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(foreign instanceof Error).toBe(false);
        expect(text).toContain('"message": "from elsewhere"');
        expect(text).toContain('"name": "Error"');
        expect(text).not.toContain("s3cret");
    });

    it("does not unbox a plain object that only claims a boxed tag", () => {
        const { consoleCalls, logger } = createFileLogger("fake-box");

        logger.info("fake", {
            [Symbol.toStringTag]: "Number",
            kept: "visible",
        });

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain('"kept": "visible"');
        expect(text).not.toContain("Circular");
    });

    it("prints boxed primitives as their primitive value", () => {
        const { consoleCalls, logger } = createFileLogger("boxed");

        logger.info("boxed", {
            flag: Object(true),
            number: Object(NUM_42),
            text: Object("hello"),
        });

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain('"text": "hello"');
        expect(text).toContain('"number": 42');
        expect(text).toContain('"flag": true');
    });

    it("stops a cyclic Error cause instead of looping", () => {
        const { consoleCalls, logger } = createFileLogger("error-cycle");
        const failure = new Error("loop");

        failure.cause = failure;
        logger.info("failed", failure);

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain('"message": "loop"');
        expect(text).toContain('"cause": "[Circular]"');
    });

    it("bounds the depth of a long cause chain", () => {
        const { consoleCalls, logger } = createFileLogger("error-depth");
        let failure = new Error("level-0");

        for (let level = NUM_1; level < 50; level += NUM_1) {
            failure = new Error(`level-${level}`, { cause: failure });
        }

        logger.info("failed", failure);

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain("[MaxDepth]");
        expect(text).not.toContain("level-0");
    });

    it("replaces cycles with a marker and keeps the other properties", () => {
        const { consoleCalls, logger } = createFileLogger("cycle");
        const node: Record<string, unknown> = { id: NUM_1 };

        node.self = node;
        node.list = [node];
        logger.info("cyclic", node);

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).not.toBe("[Object]");
        expect(text).toContain('"id": 1');
        expect(text).toContain('"self": "[Circular]"');
        expect(text).toContain('"[Circular]"');
    });

    it("does not mark a repeated, non-cyclic reference as circular", () => {
        const { consoleCalls, logger } = createFileLogger("shared");
        const shared = { value: NUM_42 };

        logger.info("shared", { first: shared, second: shared });

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).not.toContain("[Circular]");
        expect(text.match(/"value": 42/g)).toHaveLength(NUM_2);
    });

    it("serializes BigInt values inside objects", () => {
        const { consoleCalls, logger } = createFileLogger("bigint");

        logger.info("big", { id: BigInt(NUM_42), ids: [BigInt(NUM_1)] });

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).not.toBe("[Object]");
        expect(text).toContain('"id": "42n"');
        expect(text).toContain('"1n"');
    });

    it("serializes Map and Set in a readable form", () => {
        const { consoleCalls, logger } = createFileLogger("collections");

        logger.info(
            "collections",
            new Map([["alpha", { beta: NUM_1 }]]),
            new Set([NUM_1, "two"]),
        );

        const mapText = loggedArgument(consoleCalls, NUM_1);
        const setText = loggedArgument(consoleCalls, NUM_2);

        expect(mapText).toContain('"Map"');
        expect(mapText).toContain('"alpha"');
        expect(mapText).toContain('"beta": 1');
        expect(setText).toContain('"Set"');
        expect(setText).toContain('"two"');
    });

    it("keeps Date and toJSON behaviour", () => {
        const { consoleCalls, logger } = createFileLogger("to-json");

        logger.info("json", {
            at: new Date("2026-01-02T03:04:05.000Z"),
            custom: {
                toJSON(): string {
                    return "custom-json";
                },
            },
        });

        const text = loggedArgument(consoleCalls, NUM_1);

        expect(text).toContain('"at": "2026-01-02T03:04:05.000Z"');
        expect(text).toContain('"custom": "custom-json"');
    });

    it("keeps an own __proto__ key as data", () => {
        const { consoleCalls, logger } = createFileLogger("proto");

        logger.info("proto", JSON.parse('{"__proto__": {"polluted": true}}'));

        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"__proto__"');
        expect(Reflect.get({}, "polluted")).toBeUndefined();
    });
});

describe("LoggerBase serialization limits", () => {
    beforeEach(resetLoggerState);

    it("truncates a wide, deep structure with shared references quickly", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("wide");
        let level: Record<string, unknown> = { leaf: true };

        for (let depth = NUM_0; depth < NUM_6; depth += NUM_1) {
            const next: Record<string, unknown> = {};

            for (let key = NUM_0; key < 40; key += NUM_1) {
                next[`key${key}`] = level;
            }

            level = next;
        }

        const started = performance.now();

        logger.info("wide", level);

        const elapsed = performance.now() - started;
        const fileText = fileCalls[NUM_0]?.content ?? "";

        // 40^6 is about four billion leaves; the budget keeps it near 1000.
        expect(elapsed).toBeLessThan(NUM_1000);
        expect(loggedArgument(consoleCalls, NUM_1)).toContain("[Truncated]");
        expect(fileText).toContain("[Truncated]");
        expect(fileText.length).toBeLessThan(50_000);
    });

    it("keeps at most 50 keys of an object and 50 items of an array", () => {
        const { consoleCalls, logger } = createFileLogger("fifty");
        const wide: Record<string, number> = {};

        for (let key = NUM_0; key < 80; key += NUM_1) {
            wide[`k${key}`] = key;
        }

        logger.info("wide", wide, Array.from({ length: 80 }, (_, index) => index));

        const objectText = loggedArgument(consoleCalls, NUM_1);
        const arrayText = loggedArgument(consoleCalls, NUM_2);

        expect(objectText).toContain('"k49": 49');
        expect(objectText).not.toContain('"k50"');
        expect(objectText).toContain('"[Truncated]": 30');
        expect(arrayText).toContain("49");
        expect(arrayText).not.toContain("50,");
        expect(arrayText).toContain('"[Truncated]"');
    });

    it("does not walk a sparse array of length 2**32 - 1", () => {
        const { consoleCalls, logger } = createFileLogger("sparse");
        const sparse: unknown[] = [];

        sparse.length = 2 ** 32 - 1;

        const started = performance.now();

        logger.info("sparse", sparse);

        expect(performance.now() - started).toBeLessThan(200);
        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"[Truncated]"');
    });

    it("prints typed arrays, ArrayBuffer and DataView as a label with their byte length", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("binary");
        const bytes = new Uint8Array(5_000_000);

        const started = performance.now();

        logger.info(
            "binary",
            bytes,
            bytes.buffer,
            new DataView(new ArrayBuffer(NUM_6)),
            Buffer.from("secret-token"),
            { inside: new Float64Array(NUM_4) },
        );

        expect(performance.now() - started).toBeLessThan(200);
        expect(loggedArgument(consoleCalls, NUM_1)).toBe('"[Uint8Array 5000000 bytes]"');
        expect(loggedArgument(consoleCalls, NUM_2)).toBe('"[ArrayBuffer 5000000 bytes]"');
        expect(loggedArgument(consoleCalls, NUM_3)).toBe('"[DataView 6 bytes]"');
        expect(loggedArgument(consoleCalls, NUM_4)).toBe('"[Uint8Array 12 bytes]"');
        expect(loggedArgument(consoleCalls, NUM_5)).toContain('"[Float64Array 32 bytes]"');
        expect(fileCalls[NUM_0]?.content).not.toContain("secret-token");
    });

    it("stops after 50 entries of a huge Map and Set and reports the rest from size", () => {
        const { consoleCalls, logger } = createFileLogger("huge-collections");
        const hugeMap = new Map<number, number>();
        const hugeSet = new Set<number>();

        for (let index = NUM_0; index < 300_000; index += NUM_1) {
            hugeMap.set(index, index);
            hugeSet.add(index);
        }

        const started = performance.now();

        logger.info("huge", hugeMap, hugeSet);

        expect(performance.now() - started).toBeLessThan(200);
        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"[Truncated]"');
        expect(loggedArgument(consoleCalls, NUM_2)).toContain('"[Truncated]"');
    });

    it("limits Map and Set entries as well", () => {
        const { consoleCalls, logger } = createFileLogger("big-collections");
        const bigMap = new Map<number, number>();
        const bigSet = new Set<number>();

        for (let index = NUM_0; index < 80; index += NUM_1) {
            bigMap.set(index, index);
            bigSet.add(index);
        }

        logger.info("big", bigMap, bigSet);

        expect(loggedArgument(consoleCalls, NUM_1)).toContain('"[Truncated]"');
        expect(loggedArgument(consoleCalls, NUM_2)).toContain('"[Truncated]"');
    });
});

describe("LoggerBase file output escaping", () => {
    beforeEach(resetLoggerState);

    it("escapes line breaks in the message so a line cannot be forged", () => {
        const { consoleCalls, fileCalls, logger } = createFileLogger("forge");

        logger.info("first\n2026-01-01T00:00:00.000Z [INFO] [fake] - forged\r\nmore");

        const content = fileCalls[NUM_0]?.content ?? "";

        expect(content.split("\n")).toHaveLength(NUM_2);
        expect(content).not.toContain("\r");
        expect(content).toContain("first\\n2026-01-01T00:00:00.000Z");
        expect(content).toContain("forged\\r\\nmore");
        expect(loggedArgument(consoleCalls, NUM_0)).toContain("first\n2026");
    });

    it("escapes line breaks in the logger name", () => {
        const { fileCalls, logger } = createFileLogger("name\nforged");

        logger.info("hello");

        expect((fileCalls[NUM_0]?.content ?? "").split("\n")).toHaveLength(NUM_2);
        expect(fileCalls[NUM_0]?.content).toContain("[name\\nforged]");
    });

    it("escapes control characters in string arguments", () => {
        const { fileCalls, logger } = createFileLogger("control");

        logger.info("ctrl", "a\nb\u001B[31mred\u0000", "tab\there");

        const content = fileCalls[NUM_0]?.content ?? "";

        expect(content.split("\n")).toHaveLength(NUM_2);
        expect(content).not.toContain("\u001B");
        expect(content).not.toContain("\u0000");
        expect(content).toContain("a\\nb\\u001b[31mred\\u0000 tab\there");
    });

    it("escapes line and paragraph separators, NEL, DEL and bidi controls in string arguments", () => {
        const { fileCalls, logger } = createFileLogger("unicode-controls");
        const separators = [
            0x2028, 0x2029, 0x85, 0x7f, 0x202a, 0x202e, 0x2066, 0x2069, 0x200e, 0x200f,
            0x61c, 0xfeff,
        ]
            .map((codePoint) => {
                return String.fromCodePoint(codePoint);
            })
            .join("|");

        logger.info("unicode", `a${separators}b`);

        const content = fileCalls[NUM_0]?.content ?? "";

        expect(content).toContain(
            String.raw`a\u2028|\u2029|\u0085|\u007f|\u202a|\u202e|\u2066|\u2069|\u200e|\u200f|\u061c|\ufeffb`,
        );
        expect(content.split("\n")).toHaveLength(NUM_2);
        expect(content).not.toContain(String.fromCodePoint(0x2028));
        expect(content).not.toContain(String.fromCodePoint(0x2029));
        expect(content).not.toContain(String.fromCodePoint(0x7f));
    });

    it("escapes the same characters inside object values and keys in the file line", () => {
        const { fileCalls, logger } = createFileLogger("unicode-object");
        const lineSeparator = String.fromCodePoint(0x2028);
        const bidiOverride = String.fromCodePoint(0x202e);
        const deleteCharacter = String.fromCodePoint(0x7f);

        logger.info("object", {
            [`key${bidiOverride}`]: `x${lineSeparator}y${deleteCharacter}z`,
            nested: ["line1\nline2", `${bidiOverride}rtl`],
        });

        const content = fileCalls[NUM_0]?.content ?? "";

        expect(content.split("\n")).toHaveLength(NUM_2);
        expect(content).not.toContain(lineSeparator);
        expect(content).not.toContain(bidiOverride);
        expect(content).not.toContain(deleteCharacter);
        expect(content).toContain(String.raw`x\u2028y\u007fz`);
        expect(content).toContain(String.raw`\u202ertl`);
        expect(content).toContain(String.raw`line1\nline2`);
    });

    it("leaves backslashes and tabs alone", () => {
        const { fileCalls, logger } = createFileLogger("backslash");

        logger.info("path", String.raw`C:\temp\new`, "a\tb");

        expect(fileCalls[NUM_0]?.content).toContain(String.raw`C:\temp\new a	b`);
    });

    it("writes a stack trace as tab-prefixed continuation lines with an escaped header", () => {
        const { fileCalls, logger } = createFileLogger("stack");

        logger.error("boom\n2026-01-01T00:00:00.000Z [INFO] [fake] - forged");

        const stackLines = (fileCalls[NUM_1]?.content ?? "")
            .split("\n")
            .filter((line) => {
                return line.length > NUM_0;
            });

        expect(stackLines.length).toBeGreaterThan(NUM_2);
        expect(
            stackLines.every((line) => {
                return line.startsWith("\t");
            }),
        ).toBeTruthy();
        expect(stackLines[NUM_0]).toContain("boom");
        expect(stackLines[NUM_1]).toContain("2026-01-01T00:00:00.000Z [INFO]");
        expect(stackLines.some((line) => {
            return line.trimStart().startsWith("at ");
        })).toBeTruthy();
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
