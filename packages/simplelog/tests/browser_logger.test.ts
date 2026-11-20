import { describe, expect, it } from "vitest";

import { createBrowserLogWriter } from "../src/browser_console";
import { LoggerBase } from "../src/logger_factory";
import type {
    LoggerOptions,
    LoggerParent,
    LoggerRuntime,
} from "../src/logger_factory";

type ConsoleCall = Readonly<{
    args: readonly unknown[];
    type: "error" | "log";
}>;

class BrowserTestLogger extends LoggerBase {
    constructor(
        runtime: LoggerRuntime,
        name: string,
        parent?: LoggerParent,
        options: LoggerOptions = {},
    ) {
        super(
            BrowserTestLogger.bind(null, runtime),
            runtime,
            name,
            parent,
            options,
        );
    }
}

function createLogger(options: LoggerOptions = {}): {
    calls: ConsoleCall[];
    logger: BrowserTestLogger;
} {
    const calls: ConsoleCall[] = [];
    const runtime = {
        write: createBrowserLogWriter({
            error(...args: readonly unknown[]): void {
                calls.push({ args, type: "error" });
            },
            log(...args: readonly unknown[]): void {
                calls.push({ args, type: "log" });
            },
        }),
    } satisfies LoggerRuntime;

    return {
        calls,
        logger: new BrowserTestLogger(runtime, "app", undefined, options),
    };
}

describe(createBrowserLogWriter, () => {
    it("passes objects to the console as they are", () => {
        const { calls, logger } = createLogger();
        const payload = { nested: { value: 1 } };

        logger.info("loaded", payload, 42);

        expect(calls).toHaveLength(1);
        const [call] = calls;
        expect(call?.args[0]).toBe("%c%s");
        expect(call?.args[1]).toBe("color: #16a34a");
        expect(call?.args[2]).toMatch(/ \[INFO\] \[app\] - loaded$/u);
        expect(call?.args[3]).toBe(payload);
        expect(call?.args[4]).toBe(42);
    });

    it("copies an Error with the allow-list only", () => {
        const { calls, logger } = createLogger();
        const rootCause = Object.assign(new Error("socket hang up"), {
            config: { headers: { authorization: "Bearer secret" } },
        });
        const error = Object.assign(
            new Error("request failed", { cause: rootCause }),
            {
                code: "ECONNRESET",
                config: { headers: { authorization: "Bearer secret" } },
                response: { status: 500 },
            },
        );

        logger.warn(
            "upstream",
            error,
            new Error("plain cause", { cause: { token: "x" } }),
        );

        const [logged, plain] = calls[0]?.args.slice(3) ?? [];
        expect(logged).toBeInstanceOf(Error);
        expect(logged).not.toBe(error);
        expect(logged).toMatchObject({
            code: "ECONNRESET",
            message: "request failed",
            name: "Error",
            stack: error.stack,
        });
        expect(Object.keys(logged ?? {})).not.toContain("config");
        expect(Object.keys(logged ?? {})).not.toContain("response");
        const cause: unknown = Reflect.get(logged ?? {}, "cause");
        expect(cause).toBeInstanceOf(Error);
        expect(Object.keys(cause ?? {})).not.toContain("config");
        expect(Reflect.get(plain ?? {}, "cause")).toBe("[Object]");
    });

    it("copies the errors of an AggregateError", () => {
        const { calls, logger } = createLogger();
        const inner = Object.assign(new Error("inner"), { secret: "x" });

        logger.error(
            "all failed",
            new AggregateError([inner, { token: "y" }], "all"),
        );

        const errors: unknown = Reflect.get(calls[0]?.args[3] ?? {}, "errors");
        expect(Array.isArray(errors)).toBe(true);
        const [first, second] = Array.isArray(errors) ? errors : [];
        expect(first).toBeInstanceOf(Error);
        expect(Object.keys(first ?? {})).not.toContain("secret");
        expect(second).toBe("[Object]");
    });

    it("stops at a cycle in the cause chain", () => {
        const { calls, logger } = createLogger();
        const error = new Error("loop");
        error.cause = error;

        logger.info("cyclic", error);

        let current: unknown = calls[0]?.args[3];
        let depth = 0;
        while (current instanceof Error) {
            current = current.cause;
            depth += 1;
        }
        expect(current).toBe("[MaxDepth]");
        expect(depth).toBe(9);
    });

    it("never puts the message into the format string", () => {
        const { calls, logger } = createLogger({ valueColorMode: "off" });

        logger.warn("100%s done %c", "extra");

        const [call] = calls;
        expect(call?.args[0]).toBe("%s");
        expect(call?.args[1]).toMatch(/ - 100%s done %c$/u);
        expect(call?.args[2]).toBe("extra");
    });

    it("prints the stack trace of error() to console.error", () => {
        const { calls, logger } = createLogger();

        logger.error("failed");

        expect(calls.map((call) => call.type)).toEqual(["log", "error"]);
        expect(String(calls[1]?.args[0])).toContain("failed");
    });

    it("keeps the level threshold and the logger name chain", () => {
        const { calls, logger } = createLogger({ logLevelThreshold: "WARN" });

        logger.createChildLogger("child").info("hidden");
        logger.createChildLogger("child").warn("shown");

        expect(calls).toHaveLength(1);
        expect(calls[0]?.args[2]).toContain("[app -> child]");
    });
});
