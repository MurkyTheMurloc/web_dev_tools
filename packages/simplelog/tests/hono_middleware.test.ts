import { Hono } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHonoLoggerMiddleware } from "../src/hono_middleware";
import type { HonoLoggerVariables } from "../src/hono_middleware";
import { Logger as WebLogger } from "../src/web_logger";

describe("Hono logger middleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a request-scoped logger on the Hono context and logs completion metadata", async () => {
    const logger = new WebLogger("server", undefined, {
      valueColorMode: "off",
    });
    const app = new Hono<{
      Variables: HonoLoggerVariables;
    }>();

    app.use(createHonoLoggerMiddleware({ logger }));
    app.get("/health", (c) => {
      c.var.logger.info("handler reached");
      return c.text("ok");
    });

    const response = await app.request("http://localhost/health");
    const consoleLogSpy = vi.mocked(globalThis.console.log);
    const loggedMessages = consoleLogSpy.mock.calls.map((argumentsList) => {
      return `${argumentsList[0] ?? ""}`;
    });
    const requestCompletedCall = consoleLogSpy.mock.calls.find(
      (argumentsList) => {
        return `${argumentsList[0] ?? ""}`.includes("Request completed");
      },
    );

    expect(response.status).toBe(200);
    expect(loggedMessages.some((message) => message.includes("handler reached"))).toBe(true);
    expect(loggedMessages.some((message) => message.includes("Request completed"))).toBe(true);
    expect(`${requestCompletedCall?.[1] ?? ""}`).toContain('"path": "/health"');
    expect(`${requestCompletedCall?.[1] ?? ""}`).toContain('"runtime": "node"');
    expect(`${requestCompletedCall?.[1] ?? ""}`).toContain('"status": 200');
  });

  it("logs request failures with request metadata and rethrows to Hono", async () => {
    const logger = new WebLogger("server", undefined, {
      valueColorMode: "off",
    });
    const app = new Hono<{
      Variables: HonoLoggerVariables;
    }>();

    app.onError((_error, c) => {
      return c.text("boom", 500);
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
    const consoleLogSpy = vi.mocked(globalThis.console.log);
    const requestFailedCall = consoleLogSpy.mock.calls.find((argumentsList) => {
      return `${argumentsList[0] ?? ""}`.includes("Request failed");
    });

    expect(response.status).toBe(500);
    expect(`${requestFailedCall?.[1] ?? ""}`).toContain('"requestId": "req-123"');
    expect(`${requestFailedCall?.[1] ?? ""}`).toContain('"status": 500');
    expect(`${requestFailedCall?.[2] ?? ""}`).toContain('"message": "kaputt"');
  });
});
