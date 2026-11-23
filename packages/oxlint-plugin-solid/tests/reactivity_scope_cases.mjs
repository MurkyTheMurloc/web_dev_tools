// Solid 2.0 primitives whose callbacks the `reactivity` rule has to classify:
// `createDeferred` (an async memo), `until` (a tracked predicate) and
// `onFlush` (an untracked callback, like `onSettled`).
//
// Silent cases assert that `reactivity` stays quiet. Reporting cases assert the
// message text, not just the rule id, so a fixture that trips a different
// check of the same rule does not pass for the wrong reason.

const READ_OUTSIDE_SCOPE_MESSAGE =
    "Fix: make it a derived function, `const current = () => rows();`, and call `current()` where it is used";

const untilPredicate = Object.freeze({
    name: "until tracks its predicate",
    code: `import { createSignal, until } from "solid-js";

const [ready] = createSignal(false);

export const waitUntilReady = async (): Promise<void> => {
    await until(() => ready());
};
`
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
`
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
`
});

const deferredReadAfterTheGap = Object.freeze({
    name: "createDeferred reports a read placed after the first await",
    message: "is first read after an `await` or `yield`",
    code: `import { createDeferred, createSignal } from "solid-js";

declare function loadRows(): Promise<string[]>;

const [period] = createSignal(1);

export const rows = createDeferred(async () => {
    const loaded = await loadRows();

    return loaded[period()];
});
`
});

const deferredAccessorOutsideScope = Object.freeze({
    name: "createDeferred returns an accessor that needs a tracked scope",
    message: READ_OUTSIDE_SCOPE_MESSAGE,
    code: `import { createDeferred, createSignal } from "solid-js";

const [period] = createSignal(1);
const rows = createDeferred(() => period() * 2);

export const current = rows();
`
});

// `reactive-async` reports under its own rule id, so the message carries the
// `{{name}}` it names.
const deferredReadAfterAwaitInMemo = Object.freeze({
    name: "reactive-async knows a createDeferred accessor",
    message:
        "'rows' is first read after an `await` or `yield` in this `createMemo` callback",
    code: `import { createDeferred, createMemo, createSignal } from "solid-js";

declare function load(id: number): Promise<string>;

const [period] = createSignal(1);
const rows = createDeferred(() => load(period()));

export const detail = createMemo(async () => {
    const first = await load(0);

    return first + rows();
});
`
});

// A React-style dependency array is no-react-deps' report; reactivity stays
// out of it so the array is reported once, with the right fix.
const reactDepsArray = Object.freeze({
    name: "leaves a React dependency array to no-react-deps",
    code: `import { createEffect, createSignal } from "solid-js";

export const View = (props: { id: string }) => {
    const [count] = createSignal(1);
    createEffect(() => {
        console.log(count());
    }, [count, props.id]);
    return <p />;
};
`
});

const reactivityScopeSilentCases = Object.freeze([
    reactDepsArray,
    untilPredicate,
    onFlushCallback,
    deferredReadsBeforeTheGap
]);
// A handler on a native element is bound once; the message carries the fix
// with the code's own names, so an agent can apply it as written.
const conditionalHandlerBinding = Object.freeze({
    name: "names the fix for a conditional handler binding",
    message:
        "Fix: decide inside the handler, `onClick={(event) => (editing() ? save : cancel)?.(event)}`",
    code: `import { createSignal } from "solid-js";

declare function save(event: MouseEvent): void;
declare function cancel(event: MouseEvent): void;

export const View = () => {
    const [editing] = createSignal(false);
    return <button onClick={editing() ? save : cancel}>OK</button>;
};
`
});

// A direct write names the setter call that replaces it.
const storeWriteOutsideSetter = Object.freeze({
    name: "names the setter for a direct store write",
    message:
        "Fix: write through the setter's draft, `setStore((draft) => { draft.count = 1; })`",
    code: `import { createStore } from "solid-js";

export const View = () => {
    const [store, setStore] = createStore({ count: 0 });
    const reset = () => {
        store.count = 1;
    };
    return <button onClick={reset}>{store.count}</button>;
};
`
});

const signalReassigned = Object.freeze({
    name: "names the setter for a reassigned signal",
    message: "Fix: call the setter, `setCount((value) => value + 1)`",
    code: `import { createSignal } from "solid-js";

export const View = () => {
    let [count, setCount] = createSignal(0);
    const bump = () => {
        count++;
    };
    return <button onClick={bump}>{count()}</button>;
};
`
});

const reactivityScopeReportingCases = Object.freeze([
    conditionalHandlerBinding,
    storeWriteOutsideSetter,
    signalReassigned,
    deferredReadAfterTheGap,
    deferredAccessorOutsideScope,
    deferredReadAfterAwaitInMemo
]);

export { reactivityScopeReportingCases, reactivityScopeSilentCases };
