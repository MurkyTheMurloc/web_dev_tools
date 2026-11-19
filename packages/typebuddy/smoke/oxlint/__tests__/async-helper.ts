// A helper under a `__tests__/` directory: typebuddy does not apply to test
// files, so the smoke test expects silence for this async helper.

export async function loadFixture(): Promise<string> {
    return "fixture";
}

export type FixtureCandidate = string | undefined;
