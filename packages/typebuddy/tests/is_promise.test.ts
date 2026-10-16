import { describe, expect, it } from "vitest";

import { isPromise } from "../src/type_helper.js";

describe("isPromise", () => {
    it("should return true for promise inputs", () => {
        const rejectedPromise = Promise.reject(new Error("expected rejection"));
        void rejectedPromise.catch(() => undefined);

        expect(isPromise(Promise.resolve())).toBeTruthy();
        expect(isPromise(new Promise(() => {}))).toBeTruthy();
        expect(isPromise(rejectedPromise)).toBeTruthy();
        expect(isPromise(Promise.all([]))).toBeTruthy();
    });

    it("should return false for non-promise inputs", () => {
        expect(isPromise("Hello")).toBeFalsy();
        expect(isPromise(123)).toBeFalsy();
        expect(isPromise({})).toBeFalsy();
        expect(isPromise([])).toBeFalsy();
        expect(isPromise(null)).toBeFalsy();
        expect(isPromise(undefined)).toBeFalsy();
        expect(isPromise(Symbol("test"))).toBeFalsy();
        expect(isPromise(Number.NaN)).toBeFalsy();
    });
});
