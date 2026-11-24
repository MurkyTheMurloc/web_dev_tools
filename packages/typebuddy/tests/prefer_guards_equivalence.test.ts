import { describe, expect, it } from "vitest";

import { isNumber } from "../src/guards.js";
import {
    DOCUMENT_ALL_EXCLUDED,
    MAPPED,
    edgeValues,
    outcome
} from "./guard_equivalence_cases.js";

// Every native check `typebuddy/prefer-guards` rewrites gives the guard's
// answer for every value below, a thrown error included. `document.all` does
// not exist in Node: `bun run test:browser` runs the same cases in Chromium,
// with it.

const VALUES = edgeValues();

describe("prefer-guards rewrites only exact equivalents", () => {
    for (const [native, check, guard] of MAPPED) {
        it.each(VALUES)(`${native} for %s`, (_name, value) => {
            expect(outcome(() => guard(value))).toEqual(
                outcome(() => check(value))
            );
        });
    }

    // Without `document.all` these agree too; the browser run shows the one
    // value that does not.
    for (const [native, check, guard] of DOCUMENT_ALL_EXCLUDED) {
        it.each(VALUES)(
            `${native} without document.all, for %s`,
            (_name, value) => {
                expect(outcome(() => guard(value))).toEqual(
                    outcome(() => check(value))
                );
            }
        );
    }

    it("is not exact for the checks it leaves alone", () => {
        // `typeof NaN === "number"`, `isNumber(NaN)` is false.
        expect(typeof Number.NaN === "number").not.toBe(isNumber(Number.NaN));
    });
});
