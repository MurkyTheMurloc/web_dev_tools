import { isNullable, isString, isError } from "@murky-web/typebuddy";
export function describeValue(
    value: unknown,
    list: unknown,
    error: unknown
): string {
    if (isNullable(value)) {
        return "nothing";
    }
    if (isString(value)) {
        return value;
    }
    if (!isError(error)) {
        return "no error";
    }
    // A suggestion, not a fix: isArray narrows to readonly unknown[].
    if (Array.isArray(list)) {
        return "list";
    }
    return "other";
}
