// Same violations as violations.ts, but in a test-named file (`*.bench.ts`).
// typebuddy does not apply to test files, so the smoke test expects silence.
// (`*.bench.ts` instead of `*.test.ts` keeps vitest from collecting it.)

export type OptionalCandidate = string | undefined;
export type MaybeCandidate = string | null;
export type NullableCandidate = string | null | undefined;

export async function loadValue(): Promise<string> {
  return "value";
}
