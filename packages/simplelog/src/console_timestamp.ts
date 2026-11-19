/** `"iso"`: `2026-11-19T16:59:23.745Z`; `"time"`: local `16:59:23.745`. */
type TimestampFormat = "iso" | "time";

const TIME_PART_WIDTH = 2;
const MILLISECONDS_WIDTH = 3;

function padTimePart(value: number, width = TIME_PART_WIDTH): string {
    return `${value}`.padStart(width, "0");
}

/**
 * `"time"` is the local time of day, the clock a developer reads the log
 * against.
 *
 * @param {number} epochMilliseconds - The moment of the log call.
 * @param {TimestampFormat} format - The console timestamp format.
 * @returns {string} `16:59:23.745` for `"time"`, the ISO string for `"iso"`.
 */
function formatConsoleTimestamp(
    epochMilliseconds: number,
    format: TimestampFormat,
): string {
    const date = new Date(epochMilliseconds);

    if (format === "iso") {
        return date.toISOString();
    }

    return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}.${padTimePart(date.getMilliseconds(), MILLISECONDS_WIDTH)}`;
}

export { formatConsoleTimestamp };
export type { TimestampFormat };
