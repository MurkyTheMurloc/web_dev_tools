// This file is intentionally wrong.
// The smoke test should report all three rules from the typebuddy oxlint plugin.

export type OptionalCandidate = string | undefined;
export type MaybeCandidate = string | null;
export type NullableCandidate = string | null | undefined;
