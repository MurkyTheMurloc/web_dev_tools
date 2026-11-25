// This file is intentionally wrong: native checks that are exactly a typebuddy
// guard. `typebuddy/prefer-guards` reports each of them.

export function describeValue(value: unknown, list: unknown): string {
    if (value === null || value === undefined) {
        return "nothing";
    }
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof Date) {
        return "date";
    }
    if (Array.isArray(list)) {
        return "list";
    }
    // Not reported: `isNumber` is false for NaN, and `typeof window` is
    // "undefined" for `document.all` too, which `isUndefined` is not.
    if (typeof value === "number" || typeof window === "undefined") {
        return "number";
    }
    return "other";
}
