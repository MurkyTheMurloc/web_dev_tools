import { describe, expect, it } from "vitest";

import { isUlidString, isUuidString } from "../src/type_helper.js";

describe(isUuidString, () => {
    it.each([
        ["version 1", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"],
        ["version 4", "550e8400-e29b-41d4-a716-446655440000"],
        ["version 5", "886313e1-3b8a-5372-9b90-0c9aee199e5d"],
        ["version 6", "1ef21d2f-1207-6660-8c4f-419efbd44d48"],
        ["version 7", "017f22e2-79b0-7cc3-98c4-dc0c0c07398f"],
        ["version 8", "320c3d4d-cc00-875b-8ec9-32d5f69181c0"],
        ["upper case", "550E8400-E29B-41D4-A716-446655440000"],
        ["the nil UUID", "00000000-0000-0000-0000-000000000000"],
        ["the max UUID", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
        ["the max UUID in upper case", "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"],
    ])("accepts %s", (_name, input) => {
        expect(isUuidString(input)).toBeTruthy();
    });

    it.each([
        ["version 0 that is not nil", "550e8400-e29b-01d4-a716-446655440000"],
        ["version 9", "550e8400-e29b-91d4-a716-446655440000"],
        ["an invalid variant", "550e8400-e29b-41d4-c716-446655440000"],
        ["missing dashes", "550e8400e29b41d4a716446655440000"],
        ["a short input", "550e8400-e29b-41d4-a716-44665544000"],
        ["trailing text", "550e8400-e29b-41d4-a716-446655440000x"],
        ["a near-nil UUID", "00000000-0000-0000-0000-000000000001"],
        ["a near-max UUID", "ffffffff-ffff-ffff-ffff-fffffffffffe"],
    ])("rejects %s", (_name, input) => {
        expect(isUuidString(input)).toBeFalsy();
    });

    it("rejects values that are not strings", () => {
        expect(isUuidString(null)).toBeFalsy();
        expect(isUuidString(42)).toBeFalsy();
    });
});

describe(isUlidString, () => {
    it.each([
        ["upper case", "01ARZ3NDEKTSV4RRFFQ69G5FAV"],
        ["lower case", "01arz3ndektsv4rrffq69g5fav"],
        ["mixed case", "01ArZ3NdEkTsV4RrFfQ69g5FaV"],
        ["the smallest ULID", "00000000000000000000000000"],
        ["the largest ULID", "7ZZZZZZZZZZZZZZZZZZZZZZZZZ"],
    ])("accepts %s", (_name, input) => {
        expect(isUlidString(input)).toBeTruthy();
    });

    it.each([
        ["a timestamp that overflows 48 bits", "8ZZZZZZZZZZZZZZZZZZZZZZZZZ"],
        ["the all-Z string", "ZZZZZZZZZZZZZZZZZZZZZZZZZZ"],
        ["a character outside the alphabet (I)", "01ARZ3NDEKTSV4RRFFQ69G5FAI"],
        ["a character outside the alphabet (U)", "01ARZ3NDEKTSV4RRFFQ69G5FAU"],
        ["too short", "01ARZ3NDEKTSV4RRFFQ69G5FA"],
        ["too long", "01ARZ3NDEKTSV4RRFFQ69G5FAVV"],
    ])("rejects %s", (_name, input) => {
        expect(isUlidString(input)).toBeFalsy();
    });
});
