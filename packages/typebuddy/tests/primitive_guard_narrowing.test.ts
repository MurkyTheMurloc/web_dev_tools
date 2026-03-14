import {
    isArray,
    isNumber,
    isObject,
    isPromise,
    isString,
} from "../src/type_helper.js";
import type { Nullable, Optional } from "../src/types/index.js";

describe("primitive guard narrowing", () => {
    it("should preserve string literal types through isString", () => {
        const value: Optional<"ready"> = "ready";

        if (!isString(value)) {
            throw new Error("Expected a string literal.");
        }

        const narrowed: "ready" = value;
        expect(narrowed).toBe("ready");
    });

    it("should preserve numeric literal types through isNumber", () => {
        const value: Nullable<42> = 42;

        if (!isNumber(value)) {
            throw new Error("Expected a number literal.");
        }

        const narrowed: 42 = value;
        expect(narrowed).toBe(42);
    });

    it("should preserve array element types through isArray", () => {
        const value: Nullable<string[]> = ["a", "b"];

        if (!isArray(value)) {
            throw new Error("Expected an array.");
        }

        const first: string = value[0]!;
        expect(first).toBe("a");
    });

    it("should preserve object property types through isObject", () => {
        const value: Nullable<{ label: string }> = { label: "x" };

        if (!isObject(value)) {
            throw new Error("Expected an object.");
        }

        const label: string = value.label;
        expect(label).toBe("x");
    });

    it("should preserve promise payload types through isPromise", async () => {
        const value: Optional<Promise<string>> = Promise.resolve("done");

        if (!isPromise(value)) {
            throw new Error("Expected a promise.");
        }

        const narrowed: Promise<string> = value;
        await expect(narrowed).resolves.toBe("done");
    });
});
