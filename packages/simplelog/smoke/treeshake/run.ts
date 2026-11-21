import path from "node:path";

/**
 * Bundles `@murky-web/simplelog/web` the way a consumer does, through the
 * exports map, and checks what ends up in the bundle.
 *
 * - Under the `browser` condition the logger passes values to the console as they
 *   are: no JSON serializer, no ANSI text writer, no log file code, and the
 *   minified bundle stays under a budget.
 * - On a server (`node` condition) `/web` keeps the text writer with the
 *   serializer's safety rules, still without the log file code.
 */
const entry = path.join(import.meta.dir, "entry.ts");

// Minified size of the browser bundle in bytes, with some headroom over the
// measured size (4,800 with the Error copy of SID-1206). Raise it on purpose,
// not to make the check pass.
const BROWSER_BUDGET_BYTES = 5200;
const FAILURE_EXIT_CODE = 1;

const FILE_MARKERS = ["createLogFileWriter", "escapeFileCharacters", "node:fs"];

type BundleCheck = Readonly<{
    forbidden: readonly string[];
    name: string;
    required: readonly string[];
    target: "browser" | "node";
}>;

const checks: readonly BundleCheck[] = [
    {
        forbidden: [...FILE_MARKERS, "createTextLogWriter", "toJsonSafeValue"],
        name: "browser",
        required: ["createBrowserLogWriter"],
        target: "browser"
    },
    {
        forbidden: [...FILE_MARKERS, "createBrowserLogWriter"],
        name: "server",
        required: ["createTextLogWriter", "toJsonSafeValue"],
        target: "node"
    }
];

async function bundle(
    target: BundleCheck["target"],
    minify: boolean
): Promise<string> {
    const result = await Bun.build({
        entrypoints: [entry],
        minify,
        target
    });
    const [output] = result.outputs;

    if (!result.success || output === undefined) {
        throw new Error(
            `Bundling for ${target} failed:\n${result.logs.join("\n")}`
        );
    }

    return output.text();
}

const failures: string[] = [];

for (const check of checks) {
    const source = await bundle(check.target, false);

    for (const marker of check.required) {
        if (!source.includes(marker)) {
            failures.push(`${check.name}: expected "${marker}" in the bundle`);
        }
    }
    for (const marker of check.forbidden) {
        if (source.includes(marker)) {
            failures.push(`${check.name}: "${marker}" should be tree-shaken`);
        }
    }
}

const browserBytes = new TextEncoder().encode(
    await bundle("browser", true)
).byteLength;

if (browserBytes > BROWSER_BUDGET_BYTES) {
    failures.push(
        `browser: ${browserBytes} bytes minified, budget ${BROWSER_BUDGET_BYTES}`
    );
}

if (failures.length > 0) {
    console.error(`Tree-shake smoke failed:\n  ${failures.join("\n  ")}`);
    process.exit(FAILURE_EXIT_CODE);
}

console.log(
    `Tree-shake smoke passed (browser bundle ${browserBytes} bytes minified).`
);
