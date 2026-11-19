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
const EMPTY_QUERY = "";

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

type RequestOnlyReader = Readonly<{
  req: RequestLike;
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
  /**
   * The query string including the leading `?` (`"?a=1&b=2"`), or `""` when
   * there is none. It is passed to `requestLoggerName` only; the middleware
   * logs it as `query` just when `includeQuery` is on.
   */
  query: string;
  requestId: string;
  runtime: RequestRuntimeKey;
  url: string;
}>;

type RequestLoggerNameResolver = (context: RequestLoggerContext) => string;

type HonoLoggerMiddlewareOptions = Readonly<{
  /**
   * Adds the request's query string (`?a=1&b=2`) to the logged metadata as
   * `query`. Off by default: query strings often carry tokens, OAuth codes and
   * e-mail addresses, and the log keeps only the path.
   */
  includeQuery?: boolean;
  logCompletedRequests?: boolean;
  logger: Readonly<LoggerBase>;
  requestLoggerName?: RequestLoggerNameResolver | string;
}>;

type RequestLoggingState = Readonly<{
  requestLogger: Readonly<LoggerBase>;
  requestLoggerContext: RequestLoggerContext;
  startTime: number;
}>;

function resolveRequestId(c: RequestOnlyReader): string {
  const requestId = c.req.header(REQUEST_ID_HEADER);

  if (typeof requestId !== "string" || requestId.length === EMPTY_REQUEST_ID.length) {
    return EMPTY_REQUEST_ID;
  }

  return requestId;
}

function extractQuery(url: string): string {
  try {
    return new URL(url).search;
  } catch {
    // Hono hands out absolute URLs; anything else has no query we can trust.
    return EMPTY_QUERY;
  }
}

function createRequestLoggerContext(c: RequestOnlyReader): RequestLoggerContext {
  return {
    method: c.req.method,
    path: c.req.path,
    query: extractQuery(c.req.url),
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

function createRequestOnlyReader(c: MiddlewareContext): RequestOnlyReader {
  return {
    req: {
      header(name: string): string | undefined {
        return c.req.header(name);
      },
      method: c.req.method,
      path: c.req.path,
      url: c.req.url,
    },
  };
}

/**
 * Reads the response status, so call it only after `next()`. Hono's `c.res`
 * getter creates a placeholder Response on first access, and a handler's own
 * Response is then copied into a new one (`new Response(body, res)`) when it is
 * set. Touching `c.res` before the handler ran therefore replaces every
 * response and loses its identity.
 *
 * @param {MiddlewareContext} c - The Hono context, after `next()` returned.
 * @returns {RequestContextReader} The request, the error and the status.
 */
function createRequestReader(c: MiddlewareContext): RequestContextReader {
  return {
    ...createRequestOnlyReader(c),
    error: c.error,
    res: {
      status: c.res.status,
    },
  };
}

function createRequestLoggingState(
  c: MiddlewareContext,
  options: HonoLoggerMiddlewareOptions,
): RequestLoggingState {
  const requestLoggerContext = createRequestLoggerContext(
    createRequestOnlyReader(c),
  );

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
  includeQuery: boolean,
  durationMs: number,
  status: number,
): Readonly<Record<string, RequestMetadataValue>> {
  const requestMetadata: Record<string, RequestMetadataValue> = {
    durationMs,
    method: requestLoggerContext.method,
    path: requestLoggerContext.path,
    runtime: requestLoggerContext.runtime,
    status,
  };

  if (includeQuery && requestLoggerContext.query.length > EMPTY_QUERY.length) {
    requestMetadata.query = requestLoggerContext.query;
  }

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

function shouldIncludeQuery(includeQuery: boolean | undefined): boolean {
  return includeQuery ?? false;
}

function logCompletedRequest(
  c: RequestContextReader,
  requestLogger: Readonly<LoggerBase>,
  requestLoggerContext: RequestLoggerContext,
  includeQuery: boolean,
  startTime: number,
): void {
  requestLogger.info(
    REQUEST_COMPLETED_MESSAGE,
    buildRequestMetadata(
      requestLoggerContext,
      includeQuery,
      getElapsedMilliseconds(startTime),
      c.res.status,
    ),
  );
}

function logFailedRequest(
  c: RequestContextReader,
  requestLogger: Readonly<LoggerBase>,
  requestLoggerContext: RequestLoggerContext,
  includeQuery: boolean,
  startTime: number,
): void {
  requestLogger.error(
    FAILED_REQUEST_MESSAGE,
    buildRequestMetadata(
      requestLoggerContext,
      includeQuery,
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
  const includeQuery = shouldIncludeQuery(options.includeQuery);

  if (typeof requestReader.error !== "undefined") {
    logFailedRequest(
      requestReader,
      requestLoggingState.requestLogger,
      requestLoggingState.requestLoggerContext,
      includeQuery,
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
    includeQuery,
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
