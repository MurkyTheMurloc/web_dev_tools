import { describe, expect, it } from "vitest";

import { isPromise } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isPromise, () => {
    it("should return true for promise inputs", async () => {
        const rejectedPromise = Promise.reject(new Error("expected rejection"));

        expect(isPromise(Promise.resolve())).toBeTruthy();
        expect(isPromise(Promise.race([]))).toBeTruthy();
        expect(isPromise(rejectedPromise)).toBeTruthy();
        expect(isPromise(Promise.all([]))).toBeTruthy();

        await expect(rejectedPromise).rejects.toThrow("expected rejection");
    });

    it("should return false for non-promise inputs", () => {
        expect(isPromise("Hello")).toBeFalsy();
        expect(isPromise(NUM_123)).toBeFalsy();
        expect(isPromise({})).toBeFalsy();
        expect(isPromise([])).toBeFalsy();
        expect(isPromise(null)).toBeFalsy();
        expect(isPromise(missingValue)).toBeFalsy();
        expect(isPromise(Symbol("test"))).toBeFalsy();
        expect(isPromise(Number.NaN)).toBeFalsy();
    });
});
