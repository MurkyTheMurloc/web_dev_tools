const ANONYMOUS_FUNCTION_LABEL = "[Function anonymous]";
const BINARY_BUFFER_TAGS: ReadonlySet<string> = new Set([
    "[object ArrayBuffer]",
    "[object SharedArrayBuffer]",
]);
const BOXED_PRIMITIVE_TAGS: ReadonlySet<string> = new Set([
    "[object Boolean]",
    "[object Number]",
    "[object String]",
]);
const CIRCULAR_REFERENCE_LABEL = "[Circular]";
const EMPTY_FUNCTION_NAME_LENGTH = 0;
const ERROR_TAG = "[object Error]";
const FIRST_CHARACTER_INDEX = 0;
const FUNCTION_LABEL_PREFIX = "[Function ";
const FUNCTION_LABEL_SUFFIX = "]";
const HEX_RADIX = 16;
const MAX_COLLECTION_ITEMS = 50;
const MAX_DEPTH_LABEL = "[MaxDepth]";
const MAX_SERIALIZATION_DEPTH = 8;
const MAX_SERIALIZED_NODES = 1000;
const MISSING_CODE_POINT = 0;
const NOTHING = 0;
const OBJECT_LABEL = "[Object]";
const ONE = 1;
const TAG_PREFIX_LENGTH = "[object ".length;
const TAG_SUFFIX_LENGTH = "]".length;
const TRUNCATED_LABEL = "[Truncated]";
const UNICODE_ESCAPE_WIDTH = 4;
/**
 * Control characters except tab, the Unicode line and paragraph separators, and
 * the bidirectional controls (U+200E, U+200F, U+061C, U+202A to U+202E and
 * U+2066 to U+2069) plus the byte order mark (U+FEFF). They can make a log line
 * read differently from how it is stored, or end it. Anything in this set never
 * reaches a file raw. Backslashes are not escaped: that would mangle Windows
 * paths.
 */
const FILE_UNSAFE_CHARACTER_PATTERN =
    /(?!\t)[\p{Cc}\p{Zl}\p{Zp}\u{061C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}]/gu;
const FILE_CHARACTER_ESCAPES: Readonly<Record<string, string>> = {
    "\n": String.raw`\n`,
    "\r": String.raw`\r`,
};

type Serialize = (value: unknown) => unknown;

type Budget = Readonly<{
    take: () => boolean;
}>;

type TakenItems<Item> = Readonly<{
    items: readonly Item[];
    omitted: number;
}>;

/**
 * Escapes what would let a value end or fake a line in a log file: control
 * characters (line breaks above all), the Unicode line separators and the
 * bidirectional controls.
 *
 * @param {string} text - Text that is about to be written to a log file.
 * @returns {string} The text with those characters written as `\n`, `\r` or
 *   `\uXXXX`. Tab and backslash stay as they are.
 */
function escapeFileCharacters(text: string): string {
    return text.replace(FILE_UNSAFE_CHARACTER_PATTERN, (character) => {
        const knownEscape = FILE_CHARACTER_ESCAPES[character];

        if (typeof knownEscape === "string") {
            return knownEscape;
        }

        const hexCode = (
            character.codePointAt(FIRST_CHARACTER_INDEX) ?? MISSING_CODE_POINT
        )
            .toString(HEX_RADIX)
            .padStart(UNICODE_ESCAPE_WIDTH, "0");

        return `\\u${hexCode}`;
    });
}

function formatFunctionLabel(functionName: string): string {
    if (functionName.length === EMPTY_FUNCTION_NAME_LENGTH) {
        return ANONYMOUS_FUNCTION_LABEL;
    }

    return `${FUNCTION_LABEL_PREFIX}${functionName}${FUNCTION_LABEL_SUFFIX}`;
}

function createBudget(): Budget {
    let remaining = MAX_SERIALIZED_NODES;

    return {
        take(): boolean {
            if (remaining <= NOTHING) {
                return false;
            }

            remaining -= ONE;

            return true;
        },
    };
}

/**
 * Reads the first `MAX_COLLECTION_ITEMS` entries of an array by index. The rest
 * is never visited: the omitted count comes from `length`, so a sparse array of
 * length 2^32 - 1 costs as much as one of length 50.
 *
 * @param {readonly unknown[]} array - The array.
 * @returns {TakenItems<unknown>} The kept items and how many were left out.
 */
function takeArrayItems(array: readonly unknown[]): TakenItems<unknown> {
    const count = Math.min(array.length, MAX_COLLECTION_ITEMS);

    return {
        items: Array.from({ length: count }, (_unused, index) => {
            return array[index];
        }),
        omitted: array.length - count,
    };
}

/**
 * Reads the first `MAX_COLLECTION_ITEMS` entries of a Map or Set and stops
 * there. The omitted count comes from `size`.
 *
 * @param {Readonly<Iterable<Item>>} source - The Map or Set.
 * @param {number} size - Its `size`.
 * @returns {TakenItems<Item>} The kept items and how many were left out.
 */
function takeFirstItems<Item>(
    source: Readonly<Iterable<Item>>,
    size: number,
): TakenItems<Item> {
    const items: Item[] = [];

    for (const item of source) {
        if (items.length >= MAX_COLLECTION_ITEMS) {
            break;
        }

        items.push(item);
    }

    return { items, omitted: Math.max(size - items.length, NOTHING) };
}

function withTruncationMarker(
    items: readonly unknown[],
    omitted: number,
): readonly unknown[] {
    if (omitted > NOTHING) {
        return [...items, TRUNCATED_LABEL];
    }

    return items;
}

function readProperty(value: Readonly<object>, key: string): unknown {
    return Reflect.get(value, key);
}

function readString(
    value: Readonly<object>,
    key: string,
    fallback: string,
): string {
    const property = readProperty(value, key);

    if (typeof property === "string") {
        return property;
    }

    return fallback;
}

function readTag(value: Readonly<object>): string {
    return Object.prototype.toString.call(value);
}

/**
 * Recognises Errors, including those from other realms (another `vm` context,
 * an iframe), which fail `instanceof Error`. `Error.isError` is a brand check
 * and is used where the runtime has it; elsewhere `instanceof` or the `[object
 * Error]` tag decide.
 *
 * @param {Readonly<object>} value - Any object.
 * @returns {boolean} Whether it is an Error.
 */
function isError(value: Readonly<object>): boolean {
    const nativeIsError: unknown = Reflect.get(Error, "isError");

    if (typeof nativeIsError === "function") {
        return Reflect.apply(nativeIsError, Error, [value]) === true;
    }

    return value instanceof Error || readTag(value) === ERROR_TAG;
}

/**
 * Reads the primitive out of a `String`, `Number` or `Boolean` object. The
 * built-in `valueOf` of each is brand-checked and throws for anything else, so
 * a plain object that only claims one of these tags is not unboxed.
 *
 * @param {Readonly<object>} value - Any object.
 * @returns {readonly [unknown] | undefined} The primitive in a one-item tuple,
 *   or `undefined` when `value` is not a boxed primitive.
 */
function unboxPrimitive(
    value: Readonly<object>,
): readonly [unknown] | undefined {
    if (!BOXED_PRIMITIVE_TAGS.has(readTag(value))) {
        return undefined;
    }

    for (const prototype of [
        Number.prototype,
        String.prototype,
        Boolean.prototype,
    ]) {
        try {
            const valueOf: unknown = Reflect.get(prototype, "valueOf");

            if (typeof valueOf !== "function") {
                continue;
            }

            return [Reflect.apply(valueOf, value, [])];
        } catch {
            // Not this kind of box; try the next one.
        }
    }

    return undefined;
}

function readByteLength(value: Readonly<object>): number {
    const byteLength = readProperty(value, "byteLength");

    if (typeof byteLength === "number") {
        return byteLength;
    }

    return NOTHING;
}

/**
 * Typed arrays, `DataView` and `ArrayBuffer` print as a label with their byte
 * length. Their contents are not read: they can be megabytes, and Node's
 * `Buffer` has a `toJSON` that would copy every byte into an array.
 *
 * @param {Readonly<object>} value - Any object.
 * @returns {string | undefined} The label, or `undefined` for other objects.
 */
function binaryLabel(value: Readonly<object>): string | undefined {
    const tag = readTag(value);

    if (!ArrayBuffer.isView(value) && !BINARY_BUFFER_TAGS.has(tag)) {
        return undefined;
    }

    const typeName = tag.slice(TAG_PREFIX_LENGTH, -TAG_SUFFIX_LENGTH);

    return `[${typeName} ${readByteLength(value)} bytes]`;
}

/**
 * Inside an Error, a nested value prints in full only when it is an Error
 * itself. Any other object becomes a label: `cause` is often an HTTP response
 * or request object that carries credentials, and the Error allow-list would
 * mean nothing if those printed through the `cause` slot.
 *
 * @param {unknown} value - A `cause` or one element of `errors`.
 * @param {Serialize} serialize - Serializes a value under the normal rules.
 * @returns {unknown} The label, or the serialized primitive or Error.
 */
function serializeErrorChild(value: unknown, serialize: Serialize): unknown {
    if (typeof value === "object" && value !== null && !isError(value)) {
        return OBJECT_LABEL;
    }

    return serialize(value);
}

function serializeAggregatedErrors(
    errors: readonly unknown[],
    serialize: Serialize,
): readonly unknown[] {
    const { items, omitted } = takeArrayItems(errors);

    return withTruncationMarker(
        items.map((entry) => {
            return serializeErrorChild(entry, serialize);
        }),
        omitted,
    );
}

/**
 * Serializes an Error from an allow-list only: `name`, `message`, `stack`,
 * `cause`, `code` (when it is a string or a number) and, for an
 * `AggregateError`, `errors`. Other own properties are left out on purpose:
 * HTTP client errors (axios, got) carry the request, its headers and its body
 * there, which means credentials. `cause` and the elements of `errors` follow
 * the rule in `serializeErrorChild`.
 *
 * @param {Readonly<object>} error - The Error.
 * @param {Serialize} serialize - Serializes a nested value under the same
 *   rules.
 * @returns {unknown} A plain object.
 */
function serializeError(
    error: Readonly<object>,
    serialize: Serialize,
): unknown {
    const name = readString(error, "name", "Error");
    const entries: [string, unknown][] = [
        ["name", name],
        ["message", readString(error, "message", "")],
        ["stack", readString(error, "stack", "")],
    ];
    const cause = readProperty(error, "cause");
    const code = readProperty(error, "code");
    const errors = readProperty(error, "errors");

    if (typeof cause !== "undefined") {
        entries.push(["cause", serializeErrorChild(cause, serialize)]);
    }

    if (typeof code === "string" || typeof code === "number") {
        entries.push(["code", code]);
    }

    if (
        (error instanceof AggregateError || name === "AggregateError") &&
        Array.isArray(errors)
    ) {
        entries.push(["errors", serializeAggregatedErrors(errors, serialize)]);
    }

    return Object.fromEntries(entries);
}

function serializeMap(
    map: Readonly<ReadonlyMap<unknown, unknown>>,
    serialize: Serialize,
): unknown {
    const { items, omitted } = takeFirstItems(map, map.size);

    return {
        Map: withTruncationMarker(
            items.map(([key, entry]: readonly [unknown, unknown]) => {
                return [serialize(key), serialize(entry)];
            }),
            omitted,
        ),
    };
}

function serializeSet(
    set: Readonly<ReadonlySet<unknown>>,
    serialize: Serialize,
): unknown {
    const { items, omitted } = takeFirstItems(set, set.size);

    return {
        Set: withTruncationMarker(
            items.map((entry: unknown) => {
                return serialize(entry);
            }),
            omitted,
        ),
    };
}

/**
 * Serializes the own enumerable keys of an object, at most
 * `MAX_COLLECTION_ITEMS` of them. Only the values of the kept keys are visited,
 * but the key list is built in full: `Object.keys` is a single native pass, and
 * `for...in` with an early exit does not avoid it (V8 collects the keys before
 * the first iteration; measured at the same cost). An object with millions of
 * keys therefore costs one linear key listing, not millions of serializations.
 *
 * @param {Readonly<object>} value - The object.
 * @param {Serialize} serialize - Serializes a nested value.
 * @returns {unknown} A plain object, with a `[Truncated]` key when keys were
 *   left out.
 */
function serializePlainObject(
    value: Readonly<object>,
    serialize: Serialize,
): unknown {
    const allKeys = Object.keys(value);
    const entries: [string, unknown][] = allKeys
        .slice(NOTHING, MAX_COLLECTION_ITEMS)
        .map((key) => {
            return [key, serialize(readProperty(value, key))];
        });

    if (allKeys.length > MAX_COLLECTION_ITEMS) {
        entries.push([TRUNCATED_LABEL, allKeys.length - MAX_COLLECTION_ITEMS]);
    }

    return Object.fromEntries(entries);
}

function serializeCollection(
    value: Readonly<object>,
    serialize: Serialize,
): unknown {
    if (value instanceof Map) {
        return serializeMap(value, serialize);
    }

    if (value instanceof Set) {
        return serializeSet(value, serialize);
    }

    if (Array.isArray(value)) {
        const { items, omitted } = takeArrayItems(value);

        return withTruncationMarker(
            items.map((entry) => {
                return serialize(entry);
            }),
            omitted,
        );
    }

    return undefined;
}

function serializeObject(
    value: Readonly<object>,
    serialize: Serialize,
): unknown {
    if (isError(value)) {
        return serializeError(value, serialize);
    }

    const boxed = unboxPrimitive(value);

    if (typeof boxed !== "undefined") {
        return serialize(boxed[FIRST_CHARACTER_INDEX]);
    }

    const label = binaryLabel(value);

    if (typeof label === "string") {
        return label;
    }

    const collection = serializeCollection(value, serialize);

    if (typeof collection !== "undefined") {
        return collection;
    }

    const toJson = readProperty(value, "toJSON");

    if (typeof toJson === "function") {
        return serialize(Reflect.apply(toJson, value, []));
    }

    return serializePlainObject(value, serialize);
}

function serializeAtPath(
    value: unknown,
    path: readonly Readonly<object>[],
    budget: Budget,
): unknown {
    if (!budget.take()) {
        return TRUNCATED_LABEL;
    }

    if (typeof value === "bigint") {
        return `${value}n`;
    }

    if (typeof value === "symbol") {
        return value.toString();
    }

    if (typeof value === "function") {
        return formatFunctionLabel(value.name);
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    if (path.includes(value)) {
        return CIRCULAR_REFERENCE_LABEL;
    }

    if (path.length >= MAX_SERIALIZATION_DEPTH) {
        return MAX_DEPTH_LABEL;
    }

    const childPath = [...path, value];

    return serializeObject(value, (child) => {
        return serializeAtPath(child, childPath, budget);
    });
}

/**
 * Turns a value into something `JSON.stringify` can print without losing or
 * throwing on it, and without printing without limit.
 *
 * - Cycles become `"[Circular]"`, nesting deeper than 8 levels `"[MaxDepth]"`
 * - At most 1000 values in total, and 50 keys or items per object or array; what
 *   is left out becomes `"[Truncated]"`
 * - BigInt and symbols become strings, functions become their label, boxed
 *   primitives their primitive value, typed arrays, `DataView` and
 *   `ArrayBuffer` a label with their byte length
 * - `Error` becomes `{ name, message, stack, cause?, code?, errors? }`, where
 *   `cause` and `errors` elements that are not Errors print as `"[Object]"`;
 *   `Map` becomes `{ Map: [[key, value]] }` and `Set` `{ Set: [value] }`
 *
 * Only the objects on the way down count as a cycle, so an object that appears
 * twice side by side prints twice (and counts twice against the budget).
 *
 * @param {unknown} value - The value to convert.
 * @returns {unknown} A JSON-safe value.
 */
function toJsonSafeValue(value: unknown): unknown {
    return serializeAtPath(value, [], createBudget());
}

export { escapeFileCharacters, formatFunctionLabel, toJsonSafeValue };
