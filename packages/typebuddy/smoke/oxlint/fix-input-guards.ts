export function describeValue(
    value: unknown,
    list: unknown,
    error: unknown
): string {
    if (value === null || typeof value === "undefined") {
        return "nothing";
    }
    if (typeof value === "string") {
        return value;
    }
    if (!(error instanceof Error)) {
        return "no error";
    }
    // A suggestion, not a fix: isArray narrows to readonly unknown[].
    if (Array.isArray(list)) {
        return "list";
    }
    return "other";
}
