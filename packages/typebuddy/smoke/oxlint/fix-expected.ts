import { ok } from "@murky-web/typebuddy";
import { err } from "@murky-web/typebuddy";

import type { Maybe, Nullable, Optional } from "../../src/types/index.js";

export type OptionalCandidate = Optional<string>;
export type MaybeCandidate = Maybe<string>;
export type NullableCandidate = Nullable<string>;

export async function getGreeting(): MaybePromise<string> {
    try {
        return ok("hello");
    } catch {
        return err();
    }
}

export async function complete(): MaybePromise<void> {
    try {
        return ok();
    } catch {
        return err();
    }
}

export async function loadGreeting(): MaybePromise<string> {
    try {
        return ok("hi");
    } catch {
        return err();
    }
}

export async function fromObject(): MaybePromise<string> {
    try {
        return ok("from-object");
    } catch {
        return err();
    }
}

export async function wrapMe(): MaybePromise<string> {
    try {
        return ok("wrapped");
    } catch {
        return err();
    }
}
