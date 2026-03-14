import { isPromise } from "../src/type_helper.js";

describe("isPromise", () => {
    it("should return true for promise inputs", () => {
        expect(isPromise(Promise.resolve())).toBe(true);
        expect(isPromise(new Promise(() => {}))).toBe(true);
        expect(isPromise(Promise.reject())).toBe(true);
        expect(isPromise(Promise.all([]))).toBe(true);
    });

    it("should return false for non-promise inputs", () => {
        expect(isPromise("Hello")).toBe(false);
        expect(isPromise(123)).toBe(false);
        expect(isPromise({})).toBe(false);
        expect(isPromise([])).toBe(false);
        expect(isPromise(null)).toBe(false);
        expect(isPromise(undefined)).toBe(false);
        expect(isPromise(Symbol())).toBe(false);
        expect(isPromise(NaN)).toBe(false);
    });
});
