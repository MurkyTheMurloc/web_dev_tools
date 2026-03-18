import { getRuntimeKey } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";

import type { LoggerBase } from "./logger_factory";

const DEFAULT_ERROR_STATUS = 500;
const DEFAULT_REQUEST_LOGGER_NAME = "request";
const EMPTY_REQUEST_ID = "";
const FAILED_REQUEST_MESSAGE = "Request failed";
const REQUEST_COMPLETED_MESSAGE = "Request completed";
const REQUEST_ID_HEADER = "x-request-id";

type RequestRuntimeKey = ReturnType<typeof getRuntimeKey>;

type HonoLoggerVariables = {
  logger: LoggerBase;
};

type HonoLoggerMiddleware = MiddlewareHandler<{
  Variables: HonoLoggerVariables;
}>;

type RequestLike = Readonly<{
  header: (name: string) => string | undefined;
  method: string;
  path: string;
  url: string;
}>;

type ResponseLike = Readonly<{
  status: number;
}>;

type RequestContextReader = Readonly<{
  error?: unknown;
  req: RequestLike;
  res: ResponseLike;
}>;

type MiddlewareContext = Readonly<{
  error?: unknown;
  req: RequestLike;
  res: ResponseLike;
  set: (key: "logger", value: Readonly<LoggerBase>) => void;
}>;

type MiddlewareParameters = readonly [MiddlewareContext, () => Promise<void>];

type RequestMetadataValue = number | string;

type RequestLoggerContext = Readonly<{
  method: string;
  path: string;
  requestId: string;
  runtime: RequestRuntimeKey;
  url: string;
}>;

type RequestLoggerNameResolver = (context: RequestLoggerContext) => string;

type HonoLoggerMiddlewareOptions = Readonly<{
  logCompletedRequests?: boolean;
  logger: Readonly<LoggerBase>;
  requestLoggerName?: RequestLoggerNameResolver | string;
}>;

type RequestLoggingState = Readonly<{
  requestLogger: Readonly<LoggerBase>;
  requestLoggerContext: RequestLoggerContext;
  startTime: number;
}>;

function resolveRequestId(c: RequestContextReader): string {
  const requestId = c.req.header(REQUEST_ID_HEADER);

  if (typeof requestId !== "string" || requestId.length === EMPTY_REQUEST_ID.length) {
    return EMPTY_REQUEST_ID;
  }

  return requestId;
}

function createRequestLoggerContext(c: RequestContextReader): RequestLoggerContext {
  return {
    method: c.req.method,
    path: c.req.path,
    requestId: resolveRequestId(c),
    runtime: getRuntimeKey(),
    url: c.req.url,
  };
}

function resolveRequestLoggerName(
  requestLoggerContext: RequestLoggerContext,
  requestLoggerName: HonoLoggerMiddlewareOptions["requestLoggerName"],
): string {
  if (typeof requestLoggerName === "function") {
    return requestLoggerName(requestLoggerContext);
  }

  if (typeof requestLoggerName === "string") {
    return requestLoggerName;
  }

  return DEFAULT_REQUEST_LOGGER_NAME;
}

function createRequestLogger(
  logger: Readonly<LoggerBase>,
  requestLoggerContext: RequestLoggerContext,
  requestLoggerName: HonoLoggerMiddlewareOptions["requestLoggerName"],
): Readonly<LoggerBase> {
  return logger.createChildLogger(
    resolveRequestLoggerName(requestLoggerContext, requestLoggerName),
  );
}

function createRequestReader(c: MiddlewareContext): RequestContextReader {
  return {
    error: c.error,
    req: {
      header(name: string): string | undefined {
        return c.req.header(name);
      },
      method: c.req.method,
      path: c.req.path,
      url: c.req.url,
    },
    res: {
      status: c.res.status,
    },
  };
}

function createRequestLoggingState(
  c: MiddlewareContext,
  options: HonoLoggerMiddlewareOptions,
): RequestLoggingState {
  const requestLoggerContext = createRequestLoggerContext(createRequestReader(c));

  return {
    requestLogger: createRequestLogger(
      options.logger,
      requestLoggerContext,
      options.requestLoggerName,
    ),
    requestLoggerContext,
    startTime: Date.now(),
  };
}

function buildRequestMetadata(
  requestLoggerContext: RequestLoggerContext,
  durationMs: number,
  status: number,
): Readonly<Record<string, RequestMetadataValue>> {
  const requestMetadata: Record<string, RequestMetadataValue> = {
    durationMs,
    method: requestLoggerContext.method,
    path: requestLoggerContext.path,
    runtime: requestLoggerContext.runtime,
    status,
    url: requestLoggerContext.url,
  };

  if (requestLoggerContext.requestId.length > EMPTY_REQUEST_ID.length) {
    requestMetadata.requestId = requestLoggerContext.requestId;
  }

  return requestMetadata;
}

function serializeThrownError(error: unknown): Readonly<Record<string, string>> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? "",
    };
  }

  return {
    message: String(error),
    name: "UnknownError",
    stack: "",
  };
}

function getElapsedMilliseconds(startTime: number): number {
  return Date.now() - startTime;
}

function shouldLogCompletedRequests(
  logCompletedRequests: boolean | undefined,
): boolean {
  return logCompletedRequests ?? true;
}

function logCompletedRequest(
  c: RequestContextReader,
  requestLogger: Readonly<LoggerBase>,
  requestLoggerContext: RequestLoggerContext,
  startTime: number,
): void {
  requestLogger.info(
    REQUEST_COMPLETED_MESSAGE,
    buildRequestMetadata(
      requestLoggerContext,
      getElapsedMilliseconds(startTime),
      c.res.status,
    ),
  );
}

function logFailedRequest(
  c: RequestContextReader,
  requestLogger: Readonly<LoggerBase>,
  requestLoggerContext: RequestLoggerContext,
  startTime: number,
): void {
  requestLogger.error(
    FAILED_REQUEST_MESSAGE,
    buildRequestMetadata(
      requestLoggerContext,
      getElapsedMilliseconds(startTime),
      c.res.status || DEFAULT_ERROR_STATUS,
    ),
    serializeThrownError(c.error),
  );
}

function finalizeRequestLogging(
  c: MiddlewareContext,
  options: HonoLoggerMiddlewareOptions,
  requestLoggingState: RequestLoggingState,
): void {
  const requestReader = createRequestReader(c);

  if (typeof requestReader.error !== "undefined") {
    logFailedRequest(
      requestReader,
      requestLoggingState.requestLogger,
      requestLoggingState.requestLoggerContext,
      requestLoggingState.startTime,
    );
    return;
  }

  if (!shouldLogCompletedRequests(options.logCompletedRequests)) {
    return;
  }

  logCompletedRequest(
    requestReader,
    requestLoggingState.requestLogger,
    requestLoggingState.requestLoggerContext,
    requestLoggingState.startTime,
  );
}

function createHonoLoggerMiddleware(
  options: HonoLoggerMiddlewareOptions,
): HonoLoggerMiddleware {
  return createMiddleware<{
    Variables: HonoLoggerVariables;
  }>(async (...[c, next]: MiddlewareParameters): Promise<void> => {
    const requestLoggingState = createRequestLoggingState(c, options);

    c.set("logger", requestLoggingState.requestLogger);
    await next();
    finalizeRequestLogging(c, options, requestLoggingState);
  });
}

export { createHonoLoggerMiddleware };

export type {
  HonoLoggerMiddlewareOptions,
  HonoLoggerVariables,
  RequestLoggerContext,
};
