import type { Maybe, Nullable, Optional } from "../../src/types/index.js";

export type OptionalCandidate = string | undefined;
export type MaybeCandidate = string | null;
export type NullableCandidate = string | null | undefined;

export async function getGreeting(): Promise<string> {
    try {
        return "hello";
    } catch {}
}

export async function complete(): Promise<void> {
    try {
        return;
    } catch {}
}

export async function loadGreeting(): Promise<string> {
    try {
        return "hi";
    } catch {}
}

export async function fromObject(): MaybePromise<string> {
    try {
        return { isError: false, value: "from-object" };
    } catch {
        return { isError: true, value: null };
    }
}

export async function wrapMe(): Promise<string> {
    return "wrapped";
}

declare function log(message: string): void;

// A catch whose last statement has no semicolon: the inserted `return err()`
// used to be glued onto it, producing code that does not parse.
export async function oneLineCatch(): Promise<string> {
    try {
        return "one-line";
    } catch { log("boom") }
}

// The wrapping fix used to strip leading whitespace on every line, which
// silently rewrote the contents of template literals.
export async function keepsTemplate(): Promise<string> {
    return `multi
  line template`;
}

// An expression-bodied arrow has no block for the try/catch to live in.
export const arrowBody = async () => await Promise.resolve("arrow");

// A parenthesised expression body: the parentheses sit outside the body node.
export const parenthesisedArrowBody = async () => ({ wrapped: true });

// Type-level signatures can never be `async`, so the async gate used to make
// these three visitors unreachable.
export interface Loader {
    load(): Promise<string>;
}

export type LoadFn = () => Promise<string>;

// Already migrated by hand. The awaited-type lookup used to match only
// `Promise`, so this bare `return` stayed unwrapped while its `Promise<void>`
// twin two functions up was fixed.
export async function alreadyMigrated(): MaybePromise<void> {
    try {
        return;
    } catch {}
}

// `null | undefined` names no value to put in the brackets; it used to be
// rewritten to the equivalent-but-longer `Optional<null>`.
export type NeitherCandidate = null | undefined;

// `AsyncResult` is the preferred spelling of `MaybePromise`, so the awaited-type
// lookup has to know it too — otherwise the rule goes blind on exactly the
// annotation the package tells people to write.
export async function preferredSpelling(): AsyncResult<void> {
    try {
        return;
    } catch {}
}

// A value handed back from the failure path. The rule reports it — the default
// belongs in the try block — but must not rewrite it: replacing it with `err()`
// would drop the fallback, and appending one produced unreachable code.
export async function fallbackInCatch(): AsyncResult<string> {
    try {
        return ok("real");
    } catch {
        return "fallback";
    }
}

// Same for a fallback already spelled as a result: reported, never rewritten.
export async function okInCatch(): AsyncResult<string> {
    try {
        return ok("real");
    } catch {
        return ok("defaults");
    }
}

// A bare `return` in a catch loses nothing by becoming `err()`, so it is fixed.
export async function bareCatchReturn(): AsyncResult<void> {
    try {
        return ok();
    } catch {
        return;
    }
}

// Returns the try block owns, but does not hold directly. Only the last one
// used to be wrapped, because the walk never looked inside the `if`, the loop
// or the `switch`. The callback's return belongs to the callback, not here.
export async function nestedReturns(flag: boolean, n: number): AsyncResult<string> {
    try {
        if (flag) return "early";
        for (const x of [1]) {
            if (x) return "loop";
        }
        switch (n) {
            case 1:
                return "switch";
        }
        const cb = () => {
            return "belongs to the callback";
        };
        return cb();
    } catch {
        return err();
    }
}

// The inner try/catch settles this catch branch on its own, so no `return err()`
// may be appended after it — that would be unreachable.
export async function settledByNestedTry(): AsyncResult<string> {
    try {
        return ok("real");
    } catch {
        try {
            return ok("retry");
        } catch {
            return err();
        }
    }
}
