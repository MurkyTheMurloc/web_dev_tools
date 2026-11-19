import { describe, expect, expectTypeOf, it } from "vitest";

import { isEmptyObject } from "../src/type_helper.js";
import type { EmptyObject } from "../src/type_helper.js";

const NUM_123 = 123;

const missingValue: unknown = undefined;

describe(isEmptyObject, () => {
    it("should return true for plain object inputs", () => {
        expect(isEmptyObject({})).toBeTruthy();
    });

    it("should return false for non-plain object inputs", () => {
        expect(isEmptyObject(new Date())).toBeFalsy();
        expect(isEmptyObject(/abc/)).toBeFalsy();
        expect(isEmptyObject(/abc/u)).toBeFalsy();
        expect(isEmptyObject(new Error("test"))).toBeFalsy();
        expect(isEmptyObject("Hello")).toBeFalsy();
        expect(isEmptyObject(NUM_123)).toBeFalsy();
        expect(isEmptyObject([])).toBeFalsy();
        expect(isEmptyObject(null)).toBeFalsy();
        expect(isEmptyObject(missingValue)).toBeFalsy();
        expect(isEmptyObject(Symbol("test"))).toBeFalsy();
        expect(isEmptyObject(Number.NaN)).toBeFalsy();
        expect(isEmptyObject({ a: 1, b: 2 })).toBeFalsy();
        expect(isEmptyObject({ a: null, b: 2 })).toBeFalsy();
        expect(isEmptyObject({ a: undefined, b: 2 })).toBeFalsy();
    });

    it("should answer false for a revoked Proxy instead of throwing", () => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();

        expect(isEmptyObject(proxy)).toBeFalsy();
    });

    it("should answer false for a Proxy whose traps throw", () => {
        const hostile = new Proxy(
            {},
            {
                ownKeys(): never {
                    throw new Error("ownKeys trap blew up");
                },
            },
        );

        expect(isEmptyObject(hostile)).toBeFalsy();
    });

    it("should not call an object empty when it has a symbol key", () => {
        expect(isEmptyObject({ [Symbol("tag")]: 1 })).toBeFalsy();
    });

    it("should not call an object empty when it has a non-enumerable key", () => {
        const hidden = Object.defineProperty({}, "hidden", {
            enumerable: false,
            value: 1,
        });

        expect(isEmptyObject(hidden)).toBeFalsy();
    });

    it("should narrow to an empty object, never to the caller's shape", () => {
        const value: Record<string, unknown> = {};

        if (!isEmptyObject(value)) {
            throw new Error("Expected an empty object.");
        }

        expectTypeOf(value).toEqualTypeOf<EmptyObject>();
    });

    it("should keep the caller's shape in the false branch", () => {
        const load = (): { name: string } | null => {
            return { name: "murky" };
        };
        const user = load();

        if (isEmptyObject(user)) {
            throw new Error("Expected a user.");
        }

        // `value is T` removed `T` here and left `null`: the object the guard
        // just said is not empty was typed as missing.
        expectTypeOf(user).toEqualTypeOf<{ name: string } | null>();
    });
});
