import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Logger } from "../src/logger";

const temporaryDirectories = new Set<string>();

async function cleanupTemporaryDirectories(): Promise<void> {
    await Promise.all(
        [...temporaryDirectories].map(async (directoryPath) => {
            await rm(directoryPath, { force: true, recursive: true });
            temporaryDirectories.delete(directoryPath);
        })
    );
}

function createTemporaryLogPath(): string {
    const temporaryDirectoryPath = mkdtempSync(
        join(tmpdir(), "simplelog-node-test-")
    );

    temporaryDirectories.add(temporaryDirectoryPath);

    return join(temporaryDirectoryPath, "nested", "app.log");
}

describe("Node Logger", () => {
    afterEach(async () => {
        await cleanupTemporaryDirectories();
    });

    it("creates missing parent directories before writing a log file", () => {
        const logFilePath = createTemporaryLogPath();
        const logger = new Logger("node-file", undefined, {
            logFilePath,
            writeToFile: true
        });

        logger.info("persisted");

        const fileContent = readFileSync(logFilePath, "utf8");

        expect(fileContent).toContain("persisted");
    });

    it("appends later log lines instead of overwriting earlier ones", () => {
        const logFilePath = createTemporaryLogPath();
        const logger = new Logger("append-check", undefined, {
            logFilePath,
            writeToFile: true
        });

        logger.info("first");
        logger.warn("second");

        const fileContent = readFileSync(logFilePath, "utf8");

        expect(fileContent).toContain("first");
        expect(fileContent).toContain("second");
    });

    it("writes plain text to files even when console output is colorized", () => {
        const logFilePath = createTemporaryLogPath();
        const logger = new Logger("plain-file", undefined, {
            logFilePath,
            valueColorMode: "syntax",
            writeToFile: true
        });

        logger.info("hello", "world");

        const fileContent = readFileSync(logFilePath, "utf8");

        expect(fileContent).toContain("[INFO]");
        expect(fileContent).not.toContain("\u001B[");
    });
});

const ANSI_ESCAPE = "\u001B[";
const ISO_PREFIX =
    /^(?:\u001B\[\d+m)?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/u;
const TIME_PREFIX =
    /^(?:\u001B\[\d+m)?\d{2}:\d{2}:\d{2}\.\d{3}(?:\u001B\[\d+m)? /u;

describe("Node Logger console defaults", () => {
    const originalIsTTY = Object.getOwnPropertyDescriptor(
        process.stdout,
        "isTTY"
    );

    function setStdoutIsTerminal(isTerminal: boolean): void {
        Object.defineProperty(process.stdout, "isTTY", {
            configurable: true,
            value: isTerminal,
            writable: true
        });
    }

    function captureFirstConsoleLine(logger: Logger): string {
        const logSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => undefined);

        logger.info("hello", "world");

        const firstArgument: unknown = logSpy.mock.calls[0]?.[0];

        return typeof firstArgument === "string" ? firstArgument : "";
    }

    beforeEach(() => {
        // The test runner's own environment must not leak into the rules.
        vi.stubEnv("FORCE_COLOR", undefined);
        vi.stubEnv("NO_COLOR", undefined);
        vi.stubEnv("SIMPLELOG_TIMESTAMP", undefined);
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
        if (originalIsTTY === undefined) {
            Reflect.deleteProperty(process.stdout, "isTTY");
        } else {
            Object.defineProperty(process.stdout, "isTTY", originalIsTTY);
        }
        await cleanupTemporaryDirectories();
    });

    it("prints plain text with an ISO timestamp into a pipe", () => {
        setStdoutIsTerminal(false);

        const line = captureFirstConsoleLine(new Logger("pipe"));

        expect(line).not.toContain(ANSI_ESCAPE);
        expect(line).toMatch(ISO_PREFIX);
    });

    it("prints colors with the time of day in a terminal", () => {
        setStdoutIsTerminal(true);

        const line = captureFirstConsoleLine(new Logger("terminal"));

        expect(line).toContain(ANSI_ESCAPE);
        expect(line).toMatch(TIME_PREFIX);
    });

    it("drops colors in a terminal when NO_COLOR is set", () => {
        setStdoutIsTerminal(true);
        vi.stubEnv("NO_COLOR", "1");

        const line = captureFirstConsoleLine(new Logger("no-color"));

        expect(line).not.toContain(ANSI_ESCAPE);
    });

    it("prints colors into a pipe when FORCE_COLOR is set", () => {
        setStdoutIsTerminal(false);
        vi.stubEnv("FORCE_COLOR", "1");

        const line = captureFirstConsoleLine(new Logger("force-color"));

        expect(line).toContain(ANSI_ESCAPE);
        expect(line).toMatch(ISO_PREFIX);
    });

    it("prints the time of day into a pipe when SIMPLELOG_TIMESTAMP=time", () => {
        setStdoutIsTerminal(false);
        vi.stubEnv("SIMPLELOG_TIMESTAMP", "time");

        const line = captureFirstConsoleLine(new Logger("short-time"));

        expect(line).not.toContain(ANSI_ESCAPE);
        expect(line).toMatch(TIME_PREFIX);
    });

    it("lets explicit options win over the environment", () => {
        setStdoutIsTerminal(true);
        vi.stubEnv("NO_COLOR", "1");
        vi.stubEnv("SIMPLELOG_TIMESTAMP", "time");

        const line = captureFirstConsoleLine(
            new Logger("explicit", undefined, {
                timestampFormat: "iso",
                valueColorMode: "level"
            })
        );

        expect(line).toContain(ANSI_ESCAPE);
        expect(line).toMatch(ISO_PREFIX);
    });

    it("keeps the ISO timestamp in the file when the console shows the time", () => {
        setStdoutIsTerminal(true);
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const logFilePath = createTemporaryLogPath();
        const logger = new Logger("file-iso", undefined, {
            logFilePath,
            writeToFile: true
        });

        logger.info("persisted");

        const fileContent = readFileSync(logFilePath, "utf8");

        expect(fileContent).toMatch(ISO_PREFIX);
        expect(fileContent).not.toContain(ANSI_ESCAPE);
    });
});
