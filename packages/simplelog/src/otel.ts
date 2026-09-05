import { trace } from "@opentelemetry/api";

import { setSpanContextReader } from "./logger_factory";
import type { OpenTelemetryContext } from "./logger_factory";

const EMPTY: OpenTelemetryContext = { spanId: "", traceId: "" };

/**
 * Wires OpenTelemetry span ids into every log line that asks for them
 * (`includeOpenTelemetryContext: true`). Call it once at startup, before the
 * first log.
 *
 * This lives in its own entry so `@opentelemetry/api` is only in the module
 * graph of programs that want it. It registers itself on `globalThis`, which
 * makes importing it a side effect a bundler cannot remove — importing it from
 * the shared factory put ~7 kB into every browser bundle, where there is never
 * an active span to read.
 *
 * Exported as a function rather than doing the work on import: the package
 * declares `"sideEffects": false`, so an import-for-effect would be a legal
 * thing to drop.
 */
function enableOpenTelemetryContext(): void {
    setSpanContextReader((): OpenTelemetryContext => {
        const activeSpan = trace.getActiveSpan();

        if (typeof activeSpan === "undefined") {
            return EMPTY;
        }

        const spanContext = activeSpan.spanContext();

        return {
            spanId: spanContext.spanId,
            traceId: spanContext.traceId,
        };
    });
}

/**
 * Undoes `enableOpenTelemetryContext`, for tests and for shutting a worker
 * down.
 */
function disableOpenTelemetryContext(): void {
    setSpanContextReader(undefined);
}

export { disableOpenTelemetryContext, enableOpenTelemetryContext };
