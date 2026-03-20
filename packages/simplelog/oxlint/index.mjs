import { noAdHocConsoleFallbackRule } from "./no-ad-hoc-console-fallback.mjs";
import { noConsoleAliasRule } from "./no-console-alias.mjs";
import { preferChildLoggerRule } from "./prefer-child-logger.mjs";
import { preferHonoContextLoggerRule } from "./prefer-hono-context-logger.mjs";
import { preferRuntimeEntryRule } from "./prefer-runtime-entry.mjs";
import { preferSimplelogRule } from "./prefer-simplelog.mjs";
import { requireLoggerNameRule } from "./require-logger-name.mjs";

const plugin = {
    meta: {
        name: "simplelog",
    },
    rules: {
        "no-ad-hoc-console-fallback": noAdHocConsoleFallbackRule,
        "no-console-alias": noConsoleAliasRule,
        "prefer-child-logger": preferChildLoggerRule,
        "prefer-hono-context-logger": preferHonoContextLoggerRule,
        "prefer-runtime-entry": preferRuntimeEntryRule,
        "prefer-simplelog": preferSimplelogRule,
        "require-logger-name": requireLoggerNameRule,
    },
};

// oxlint-disable-next-line import/no-default-export -- Oxlint JS plugins require a default export surface.
export default plugin;
export { plugin as simplelogPlugin };
