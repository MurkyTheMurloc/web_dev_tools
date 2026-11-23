import { describe, expect, it } from "vitest";

import plugin from "../src/index.mjs";

// Every report message names its fix (docs/lint-messages.md): agents apply a
// message as written. Suggestion labels are short editor actions, not
// reports, and are listed here by id.
const SUGGESTION_LABELS = new Set([
    "event-handlers.make-handler",
    "no-cleanup-in-effect-apply.returnCleanup",
    "no-innerhtml.useInnerText",
    "no-react-deps.deleteDeps",
    "no-react-deps.splitEffect",
    "no-react-deps.useOnSettled",
    "prefer-ref-shorthand.useCallback",
    "prefer-show.useShow"
]);

const messages = Object.entries(plugin.rules).flatMap(([rule, definition]) => {
    return Object.entries(definition.meta?.messages ?? {}).map(([id, text]) => {
        return { id: `${rule}.${id}`, text };
    });
});

describe("lint messages", () => {
    for (const { id, text } of messages.filter((message) => {
        return !SUGGESTION_LABELS.has(message.id);
    })) {
        it(`${id} names its fix`, () => {
            expect(text).toContain("Fix:");
        });
    }
});
