import { describe, expect, it } from "vitest";

import { parseDomainName } from "../src/type_helper.js";

describe("parseDomainName", () => {
    it("should parse the first hostname segment from common URLs", () => {
        expect(parseDomainName("https://www.example.com/path")).toBe("example");
        expect(parseDomainName("https://www2.example.com")).toBe("example");
        expect(parseDomainName("subdomain.example.dev")).toBe("subdomain");
        expect(parseDomainName("localhost:3000")).toBe("localhost");
    });

    it("should return the default value for invalid URLs", () => {
        expect(parseDomainName("")).toBeUndefined();
        expect(parseDomainName("/only/a/path", "fallback")).toBe("fallback");
    });
});
