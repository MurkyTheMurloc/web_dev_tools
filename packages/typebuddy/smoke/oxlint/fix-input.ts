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
