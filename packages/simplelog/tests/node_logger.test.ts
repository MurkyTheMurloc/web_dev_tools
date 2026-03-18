import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { Logger } from "../src/logger";

const temporaryDirectories = new Set<string>();

async function cleanupTemporaryDirectories(): Promise<void> {
  await Promise.all(
    [...temporaryDirectories].map(async (directoryPath) => {
      await rm(directoryPath, { force: true, recursive: true });
      temporaryDirectories.delete(directoryPath);
    }),
  );
}

function createTemporaryLogPath(): string {
  const temporaryDirectoryPath = mkdtempSync(
    join(tmpdir(), "simplelog-node-test-"),
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
      writeToFile: true,
    });

    logger.info("persisted");

    const fileContent = readFileSync(logFilePath, "utf8");

    expect(fileContent).toContain("persisted");
  });

  it("appends later log lines instead of overwriting earlier ones", () => {
    const logFilePath = createTemporaryLogPath();
    const logger = new Logger("append-check", undefined, {
      logFilePath,
      writeToFile: true,
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
      writeToFile: true,
    });

    logger.info("hello", "world");

    const fileContent = readFileSync(logFilePath, "utf8");

    expect(fileContent).toContain("[INFO]");
    expect(fileContent).not.toContain("\u001B[");
  });
});
