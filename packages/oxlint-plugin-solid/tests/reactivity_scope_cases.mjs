// Solid 2.0 primitives whose callbacks the `reactivity` rule has to classify:
// `createDeferred` (an async memo), `until` (a tracked predicate) and
// `onFlush` (an untracked callback, like `onSettled`).
//
// Silent cases assert that `reactivity` stays quiet. Reporting cases assert the
// message text, not just the rule id, so a fixture that trips a different
// check of the same rule does not pass for the wrong reason.

const READ_OUTSIDE_SCOPE_MESSAGE =
    "The reactive variable 'rows' should be used within JSX";

const untilPredicate = Object.freeze({
    name: "until tracks its predicate",
    code: `import { createSignal, until } from "solid-js";

const [ready] = createSignal(false);

export const waitUntilReady = async (): Promise<void> => {
    await until(() => ready());
};
`,
});

const onFlushCallback = Object.freeze({
    name: "onFlush runs its callback untracked, like onSettled",
    code: `import { createSignal, onFlush } from "solid-js";

const [count] = createSignal(0);

export const logOnFlush = (): void => {
    onFlush(() => {
        console.log(count());
    });
};
`,
});

const deferredReadsBeforeTheGap = Object.freeze({
    name: "createDeferred may be async and read its inputs before awaiting",
    code: `import { createDeferred, createSignal } from "solid-js";

declare function loadRows(period: number): Promise<string[]>;

const [period] = createSignal(1);

export const rows = createDeferred(async () => {
    const current = period();
    const loaded = await loadRows(current);

    return loaded;
});
`,
});

const deferredReadAfterTheGap = Object.freeze({
    name: "createDeferred reports a read placed after the first await",
    message: "is read after an await",
    code: `import { createDeferred, createSignal } from "solid-js";

declare function loadRows(): Promise<string[]>;

const [period] = createSignal(1);

export const rows = createDeferred(async () => {
    const loaded = await loadRows();

    return loaded[period()];
});
`,
});

const deferredAccessorOutsideScope = Object.freeze({
    name: "createDeferred returns an accessor that needs a tracked scope",
    message: READ_OUTSIDE_SCOPE_MESSAGE,
    code: `import { createDeferred, createSignal } from "solid-js";

const [period] = createSignal(1);
const rows = createDeferred(() => period() * 2);

export const current = rows();
`,
});

// `reactive-async` reports under its own rule id, so the message carries the
// `{{name}}` it names.
const deferredReadAfterAwaitInMemo = Object.freeze({
    name: "reactive-async knows a createDeferred accessor",
    message: "'rows' is read after an `await` in this `createMemo` callback",
    code: `import { createDeferred, createMemo, createSignal } from "solid-js";

declare function load(id: number): Promise<string>;

const [period] = createSignal(1);
const rows = createDeferred(() => load(period()));

export const detail = createMemo(async () => {
    const first = await load(0);

    return first + rows();
});
`,
});

const reactivityScopeSilentCases = Object.freeze([
    untilPredicate,
    onFlushCallback,
    deferredReadsBeforeTheGap,
]);
const reactivityScopeReportingCases = Object.freeze([
    deferredReadAfterTheGap,
    deferredAccessorOutsideScope,
    deferredReadAfterAwaitInMemo,
]);

export { reactivityScopeReportingCases, reactivityScopeSilentCases };
