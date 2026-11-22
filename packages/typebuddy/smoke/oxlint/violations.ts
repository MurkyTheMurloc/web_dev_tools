// This file is intentionally wrong.
// The smoke test should report all three rules from the typebuddy oxlint plugin.

export type OptionalCandidate = string | undefined;
export type MaybeCandidate = string | null;
export type NullableCandidate = string | null | undefined;

// `undefined` as the start value of an `Optional` is kept; without the type it
// is reported.
export function startValues(): void {
    let kept: string | undefined = undefined;
    let reported = undefined;
    kept = "a";
    reported = kept;
    console.log(reported);
}
