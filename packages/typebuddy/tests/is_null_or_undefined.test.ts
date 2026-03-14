import { isNullOrUndefined } from "../src/type_helper.js";

describe("isNullOrUndefined", () => {
    it("should return true for null or undefined inputs", () => {
        expect(isNullOrUndefined(null)).toBe(true);
        expect(isNullOrUndefined(undefined)).toBe(true);
        expect(isNullOrUndefined({})).toBe(true);
        expect(isNullOrUndefined([])).toBe(true);
        expect(
            isNullOrUndefined([
                {
                    test: null,
                },
            ])
        ).toBe(true);
        expect(
            isNullOrUndefined([
                {
                    test: undefined,
                },
            ])
        ).toBe(true);
        expect(
            isNullOrUndefined([
                {
                    test: [],
                },
            ])
        ).toBe(true);
        expect(
            isNullOrUndefined([
                {
                    test: [
                        {
                            test: null,
                        },
                    ],
                },
            ])
        ).toBe(true);
    });

    it("should return false for non-null or non-undefined inputs", () => {
        expect(isNullOrUndefined("Hello")).toBe(false);
        expect(isNullOrUndefined(123)).toBe(false);
        expect(isNullOrUndefined(Symbol())).toBe(false);
        expect(isNullOrUndefined(NaN)).toBe(false);
        expect(isNullOrUndefined(1)).toBe(false);
        expect(isNullOrUndefined(0)).toBe(false);
    });
});
