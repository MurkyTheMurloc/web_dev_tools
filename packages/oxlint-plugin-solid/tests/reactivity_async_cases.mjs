// Solid 2.0 supports async computations, so `reactivity` cannot ban the `async`
// keyword outright — `createMemo(async () => …)` is the shape the official docs
// demonstrate. What it must still catch is a reactive read placed after the first
// await, which registers no dependency because tracking is synchronous.
//
// These live outside `rule_cases.mjs` because that file only carries "this code
// reports rule X" cases, and the half that matters here is the one that must stay
// silent.
//
// The reporting cases assert the message, not the rule id: `reactivity` reports a
// dozen different problems, and a fixture that trips a different one would otherwise
// pass for the wrong reason. The silent case asserts the rule id, which is stricter —
// the old blanket rule reported this exact fixture, so this test fails on it.

const READ_AFTER_GAP_MESSAGE = "is read after an await";

const readsBeforeTheGap = Object.freeze({
    name: "allows an async computation that reads its inputs before awaiting",
    code: `import { createMemo, createSignal } from "solid-js";

declare function loadUser(id: number): Promise<string>;

export const createProfile = (): unknown => {
    const [userId] = createSignal(1);
    const profile = createMemo(async () => {
        const id = userId();
        const user = await loadUser(id);
        return user;
    });

    return profile;
};
`,
});

const readsAfterTheGap = Object.freeze({
    name: "reports a reactive read placed after the first await",
    code: `import { createMemo, createSignal } from "solid-js";

declare function loadUsers(): Promise<string[]>;

export const createProfile = (): unknown => {
    const [userId] = createSignal(1);
    const profile = createMemo(async () => {
        const users = await loadUsers();
        return users[userId()];
    });

    return profile;
};
`,
});

// A generator driven by `action` suspends at `yield`, and a read afterwards is
// detached for the same reason.
const readsAfterAYield = Object.freeze({
    name: "reports a reactive read placed after a yield",
    code: `import { createMemo, createSignal } from "solid-js";

declare function save(draft: string): Promise<void>;

export const createSaver = (): unknown => {
    const [draft] = createSignal("");
    const saver = createMemo(async function* () {
        yield save("");
        return draft();
    });

    return saver;
};
`,
});

const reactivityAsyncSilentCases = Object.freeze([readsBeforeTheGap]);
const reactivityAsyncReportingCases = Object.freeze([
    readsAfterTheGap,
    readsAfterAYield,
]);

export {
    READ_AFTER_GAP_MESSAGE,
    reactivityAsyncReportingCases,
    reactivityAsyncSilentCases,
};
