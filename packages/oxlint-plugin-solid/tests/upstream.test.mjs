import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
    BASELINE_PATH,
    runUpstreamCases,
    toBaseline
} from "../upstream/run.mjs";

// eslint-plugin-solid's own test cases, run against our plugin. The baseline
// holds every case we knowingly handle differently. A new entry is a
// regression; an entry that disappears is progress, so the baseline has to
// shrink with it: `bun upstream/run.mjs --write-baseline`.
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const actual = toBaseline(runUpstreamCases());

describe("upstream eslint-plugin-solid cases", () => {
    for (const [rule, buckets] of Object.entries(actual)) {
        it(rule, () => {
            expect(buckets).toEqual(baseline[rule]);
        });
    }
});
