import { describe, expect, it } from "vitest";

import { err, isSuccess, ok } from "../src/type_helper.js";

describe("ok and err", () => {
    it("should build success objects with payloads", () => {
        expect(ok("ready")).toEqual({
            isError: false,
            value: "ready",
        });
    });

    it("should build a void success without an explicit payload", () => {
        expect(ok()).toEqual({
            isError: false,
            value: undefined,
        });
    });

    it("should build the default failed result", () => {
        expect(err()).toEqual({
            isError: true,
            value: null,
        });
    });

    it("should align with isSuccess narrowing", () => {
        expect(isSuccess(ok("x"))).toBe(true);
        expect(isSuccess(err())).toBe(false);
    });
});
