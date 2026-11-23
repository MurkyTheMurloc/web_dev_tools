import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createLintHarness } from "./helpers.mjs";

const RULE = "solid(no-magic-numbers)";
const FILE = "src/magic.ts";
const BASE = { ignore: [-1, 0, 1, 2] };
const TS_OPTIONS = {
    ignoreArrayIndexes: true,
    ignoreClassFieldInitialValues: true,
    ignoreDefaultValues: true,
    ignoreEnums: true,
    ignoreNumericLiteralTypes: true,
    ignoreReadonlyClassProperties: true,
    ignoreTypeIndexes: true
};

// One number per option; `ignore: [13]` covers the ignore list.
const OPTIONS_CODE = `declare const items: number[];
export enum Level { High = 7 }
export type Small = 3 | 4;
export type Row = string[][6];
export class Box { readonly size = 9; width = 10; }
export function pad(value = 11): number { return value; }
export const first = items[5];
export const scaled = items.length * 13;
`;
const OPTION_NUMBERS = ["7", "3", "4", "6", "9", "10", "11", "5"];

const CONST_CODE = `export let limit = 50;
export const config = { retries: 51 };
`;

const HTTP_CODE = `declare const c: {
    body(data: null, status: number): Response;
    html(html: string, status: number): Response;
    json(data: unknown, status: number): Response;
    newResponse(data: null, status: number): Response;
    redirect(location: string, status: number): Response;
    status(status: number): void;
    text(text: string, status: number): Response;
};
declare class HTTPException { constructor(status: number); }
declare const res: Response;
declare const items: number[];
declare const size: number;

export function handle(): unknown[] {
    c.status(503);
    let timeout = 0;
    timeout = 404;
    return [
        c.json({}, 404),
        c.text("x", 201),
        c.html("x", 500),
        c.body(null, 204),
        c.newResponse(null, 418),
        c.redirect("/", 302),
        new HTTPException(401),
        new Response(null, { status: 404 }),
        Response.json({}, { status: 201 }),
        res.status === 404 || res.status >= 500,
        c.json({}, 600),
        items[404],
        size * 500,
        timeout
    ];
}
`;
const HTTP_STILL_REPORTED = [
    "`600` in `c.json({}, 600)`",
    "`404` in `items[404]`",
    "`500` in `size * 500`",
    "`404` in `timeout = 404;`"
];
const HTTP_CONTEXTS = 12;

// Linted with the shared config from solid.jsonc.
const MESSAGE_CODE = `declare const retry: () => void;
declare const poll: () => void;
declare const input: string;
declare const size: number;
declare const Bun: { sleep: (ms: number) => Promise<void> };

let retryDelay = 0;
let maxUpload = 0;

export function start(): unknown[] {
    setTimeout(retry, 1000);
    setInterval(poll, 5000);
    retryDelay = 750;
    maxUpload = 5 * 1024;
    const m = /(\\d+)-(\\d+)-(\\d+)/u.exec(input);
    const fromLoop = [];
    for (const match of input.matchAll(/(a)(b)(c)(d)/gu)) {
        fromLoop.push(match[4]);
    }
    return [
        AbortSignal.timeout(8000),
        Bun.sleep(250),
        size / 1024,
        m?.[3],
        input.match(/(a)(b)(c)/u)?.[3],
        size * 300,
        retryDelay,
        maxUpload,
        fromLoop
    ];
}
`;

const MESSAGES = {
    "timeout from setTimeout":
        "`1000` in `setTimeout(retry, 1000);` is an unnamed number: it hides what the value means, and every copy of it is repeated without a link to the others. Fix: `const RETRY_DELAY_MS = 1000;` at module scope, used as `setTimeout(retry, RETRY_DELAY_MS);`.",
    "interval from setInterval":
        "Fix: `const POLL_INTERVAL_MS = 5000;` at module scope, used as `setInterval(poll, POLL_INTERVAL_MS);`.",
    "timeout from AbortSignal.timeout":
        "Fix: `const DESCRIPTIVE_NAME_TIMEOUT_MS = 8000;` at module scope, named for what the number means, used as `AbortSignal.timeout(DESCRIPTIVE_NAME_TIMEOUT_MS)`.",
    "delay from Bun.sleep":
        "Fix: `const DESCRIPTIVE_NAME_DELAY_MS = 250;` at module scope, named for what the number means, used as `Bun.sleep(DESCRIPTIVE_NAME_DELAY_MS)`.",
    "milliseconds from a name with delay":
        "Fix: `const RETRY_DELAY_MS = 750;` at module scope, used as `retryDelay = RETRY_DELAY_MS;`.",
    "bytes from a product with 1024":
        "Fix: `const MAX_UPLOAD_BYTES = 5 * 1024;` at module scope, used as `maxUpload = MAX_UPLOAD_BYTES;`.",
    "KiB from a division by 1024":
        "Fix: `const BYTES_PER_KIB = 1024;` at module scope, used as `size / BYTES_PER_KIB`. A value in KiB gets the suffix `_KIB`, one in bytes `_BYTES`.",
    "capture group for an .exec() result":
        "`3` in `m?.[3]` is an unnamed number: it hides what the value means, and every copy of it is repeated without a link to the others. Fix: a named capture group, `(?<name>…)`, read as `m.groups.name`, or destructure the match (`const [, first, second] = m`).",
    "capture group for a .matchAll() loop variable":
        "read as `match.groups.name`, or destructure the match (`const [, first, second] = match`).",
    "capture group for a .match() call":
        "`3` in `input.match(/(a)(b)(c)/u)?.[3]` is an unnamed number: it hides what the value means, and every copy of it is repeated without a link to the others. Fix: a named capture group",
    "placeholder for a plain number":
        "`300` in `size * 300` is an unnamed number: it hides what the value means, and every copy of it is repeated without a link to the others. Fix: `const DESCRIPTIVE_NAME = 300;` at module scope, named for what the number means, used as `size * DESCRIPTIVE_NAME`.",
    "Do not":
        "Do not: name it after its value (`const ONE_THOUSAND = 1000`, `const FOUR = 4`), declare the same constant again in another file, or add `// oxlint-disable`."
};

function count(text, fragment) {
    return text.split(fragment).length - 1;
}

let harness = null;

// Oxlint wraps long messages onto `  | ` continuation lines.
async function lint(code, options) {
    const result = await harness.lint(code, {
        fileName: FILE,
        rules:
            options === undefined
                ? undefined
                : { "solid/no-magic-numbers": ["error", options] }
    });
    return { output: result.output.replace(/\n\s*\| /gu, " ") };
}

beforeAll(async () => {
    harness = await createLintHarness();
});

afterAll(async () => {
    await harness?.cleanup();
});

describe("solid/no-magic-numbers options", () => {
    test("without options every number is reported", async () => {
        const { output } = await lint(OPTIONS_CODE, { ignore: [13] });

        for (const raw of OPTION_NUMBERS) {
            expect(output).toContain(`\`${raw}\` in`);
        }
        expect(output).not.toContain("`13` in");
    });

    test("each ignore option silences its number", async () => {
        const { output } = await lint(OPTIONS_CODE, {
            ignore: [13],
            ...TS_OPTIONS
        });

        expect(output).not.toContain(RULE);
    });

    test("the shared config replaces eslint's rule", async () => {
        const { output } = await lint(OPTIONS_CODE);

        expect(output).not.toContain("eslint(no-magic-numbers)");
        expect(output).toContain("`5` in `const first = items[5];`");
        expect(output).not.toContain("`7` in");
    });

    test("objects and let declarations pass by default", async () => {
        const { output } = await lint(CONST_CODE, BASE);

        expect(output).not.toContain(RULE);
    });

    test("enforceConst and detectObjects report them", async () => {
        const { output } = await lint(CONST_CODE, {
            ...BASE,
            detectObjects: true,
            enforceConst: true
        });

        expect(output).toContain(
            "`50` in `let limit = 50;` is declared with `let`, so the name can be reassigned and stops naming one value. Fix: `const LIMIT = 50;`"
        );
        expect(output).toContain("`51` in `const config = { retries: 51 };`");
    });
});

describe("solid/no-magic-numbers allowHttpStatusCodes", () => {
    test("off: status codes are reported like any number", async () => {
        const { output } = await lint(HTTP_CODE, {
            ...BASE,
            detectObjects: true
        });

        expect(count(output, `${RULE}:`)).toBe(
            HTTP_CONTEXTS + HTTP_STILL_REPORTED.length
        );
    });

    test("on: only status codes used as one pass", async () => {
        const { output } = await lint(HTTP_CODE, {
            ...BASE,
            allowHttpStatusCodes: true,
            detectObjects: true
        });

        for (const fragment of HTTP_STILL_REPORTED) {
            expect(output).toContain(fragment);
        }
        expect(count(output, `${RULE}:`)).toBe(HTTP_STILL_REPORTED.length);
    });
});

describe("solid/no-magic-numbers messages", () => {
    let output = "";

    beforeAll(async () => {
        ({ output } = await lint(MESSAGE_CODE));
    });

    for (const [name, message] of Object.entries(MESSAGES)) {
        test(name, () => {
            expect(output).toContain(message);
        });
    }
});
