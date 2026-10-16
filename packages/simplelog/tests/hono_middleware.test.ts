import { Hono } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHonoLoggerMiddleware } from "../src/hono_middleware";
import type { HonoLoggerVariables } from "../src/hono_middleware";
import { Logger as WebLogger } from "../src/web_logger";

const NUM_0 = 0;
const NUM_1 = 1;
const NUM_2 = 2;
const NUM_200 = 200;
const NUM_500 = 500;

type LoggedCall = readonly unknown[] | undefined;

function noop(): void {
  // intentionally empty
}

function setUpConsoleSpies(): void {
  vi.restoreAllMocks();
  vi.spyOn(globalThis.console, "error").mockImplementation(noop);
  vi.spyOn(globalThis.console, "log").mockImplementation(noop);
}

function restoreMocks(): void {
  vi.restoreAllMocks();
}

function argumentText(call: LoggedCall, index: number): string {
  const value = call?.[index];

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function createApp(): Hono<{ Variables: HonoLoggerVariables }> {
  const logger = new WebLogger("server", undefined, {
    valueColorMode: "off",
  });
  const app = new Hono<{
    Variables: HonoLoggerVariables;
  }>();

  app.use(createHonoLoggerMiddleware({ logger }));

  return app;
}

function loggedCalls(): readonly LoggedCall[] {
  return vi.mocked(globalThis.console.log).mock.calls;
}

describe("Hono logger middleware completion", () => {
  beforeEach(setUpConsoleSpies);
  afterEach(restoreMocks);

  it("exposes a request-scoped logger on the Hono context and logs completion metadata", async () => {
    const app = createApp();

    app.get("/health", (c) => {
      c.var.logger.info("handler reached");
      return c.text("ok");
    });

    const response = await app.request("http://localhost/health");
    const loggedMessages = loggedCalls().map((call) => {
      return argumentText(call, NUM_0);
    });
    const requestCompletedCall = loggedCalls().find((call) => {
      return argumentText(call, NUM_0).includes("Request completed");
    });

    expect(response.status).toBe(NUM_200);
    expect(loggedMessages.some((message) => {
      return message.includes("handler reached");
    })).toBeTruthy();
    expect(loggedMessages.some((message) => {
      return message.includes("Request completed");
    })).toBeTruthy();
    expect(argumentText(requestCompletedCall, NUM_1)).toContain('"path": "/health"');
    expect(argumentText(requestCompletedCall, NUM_1)).toContain('"runtime": "node"');
    expect(argumentText(requestCompletedCall, NUM_1)).toContain('"status": 200');
  });
});

describe("Hono logger middleware failures", () => {
  beforeEach(setUpConsoleSpies);
  afterEach(restoreMocks);

  it("logs request failures with request metadata and rethrows to Hono", async () => {
    const app = new Hono<{
      Variables: HonoLoggerVariables;
    }>();
    const logger = new WebLogger("server", undefined, {
      valueColorMode: "off",
    });

    app.onError((_error, c) => {
      return c.text("boom", NUM_500);
    });
    app.use(createHonoLoggerMiddleware({ logger }));
    app.get("/boom", () => {
      throw new Error("kaputt");
    });

    const response = await app.request("http://localhost/boom", {
      headers: {
        "x-request-id": "req-123",
      },
    });
    const requestFailedCall = loggedCalls().find((call) => {
      return argumentText(call, NUM_0).includes("Request failed");
    });

    expect(response.status).toBe(NUM_500);
    expect(argumentText(requestFailedCall, NUM_1)).toContain('"requestId": "req-123"');
    expect(argumentText(requestFailedCall, NUM_1)).toContain('"status": 500');
    expect(argumentText(requestFailedCall, NUM_2)).toContain('"message": "kaputt"');
  });
});
