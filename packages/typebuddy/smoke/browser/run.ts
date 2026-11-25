// The prefer-guards equivalence cases in a real browser engine, where
// `document.all` exists. Bundles smoke/browser/equivalence.ts, loads it in
// headless Chromium (`--dump-dom`, no driver library needed) and checks:
//
// - this engine has `document.all` with its special `typeof`/`==` behaviour,
// - every check the rule rewrites agrees with its guard on every value,
//   `document.all` and values from another realm included,
// - every check the rule leaves out for `document.all` really disagrees there,
//   and only there.
//
// The browser: $TYPEBUDDY_CHROME, else Playwright's headless shell or Chromium
// from its cache, else Chrome/Chromium on the PATH or in /Applications. Without
// one the run is skipped, unless TYPEBUDDY_REQUIRE_BROWSER=1 (CI sets it).

import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const entry = new URL("./equivalence.ts", import.meta.url).pathname;

function playwrightCandidates(): string[] {
    const caches = [
        join(homedir(), "Library/Caches/ms-playwright"),
        join(homedir(), ".cache/ms-playwright")
    ];
    const patterns = [
        "chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell",
        "chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium",
        "chromium-*/chrome-linux*/chrome"
    ];

    const found: string[] = [];
    for (const cache of caches.filter((path) => existsSync(path))) {
        for (const pattern of patterns) {
            const glob = new Bun.Glob(pattern);
            for (const match of glob.scanSync({
                cwd: cache,
                onlyFiles: true
            })) {
                found.push(join(cache, match));
            }
        }
    }

    // Newest Playwright revision first.
    return found.toSorted().toReversed();
}

async function findBrowser(): Promise<string | null> {
    const fromEnvironment = process.env["TYPEBUDDY_CHROME"];
    if (fromEnvironment !== undefined && fromEnvironment !== "") {
        return fromEnvironment;
    }

    const candidates = [
        ...playwrightCandidates(),
        ...[
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser"
        ].map((name) => Bun.which(name) ?? ""),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
    for (const candidate of candidates) {
        if (candidate !== "" && (await Bun.file(candidate).exists())) {
            return candidate;
        }
    }

    return null;
}

function fail(message: string, details?: unknown): never {
    console.error(`Browser equivalence check failed: ${message}`);
    if (details !== undefined) {
        console.error(JSON.stringify(details, null, 2));
    }
    process.exit(1);
}

const browser = await findBrowser();
if (browser === null) {
    if (process.env["TYPEBUDDY_REQUIRE_BROWSER"] === "1") {
        fail("no Chromium or Chrome found and TYPEBUDDY_REQUIRE_BROWSER=1.");
    }
    console.log(
        "Browser equivalence check skipped: no Chromium or Chrome found (set TYPEBUDDY_CHROME)."
    );
    process.exit(0);
}

const build = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "iife"
});
const [bundle] = build.outputs;
if (!build.success || bundle === undefined) {
    fail("the bundle did not build.", build.logs);
}
const script = (await bundle.text()).replaceAll("</script", "<\\/script");

const directory = await mkdtemp(join(tmpdir(), "typebuddy-browser-"));
try {
    const page = join(directory, "index.html");
    await writeFile(
        page,
        `<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="result">not run</pre><script>${script}</script></body></html>`,
        "utf8"
    );

    const run = Bun.spawnSync([
        browser,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        `--user-data-dir=${join(directory, "profile")}`,
        "--dump-dom",
        `file://${page}`
    ]);
    const dom = run.stdout.toString();
    const match = /<pre id="result">([\s\S]*?)<\/pre>/u.exec(dom);
    const text = match?.[1]
        ?.replaceAll("&quot;", '"')
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&");
    if (text === undefined || text === "not run") {
        fail(`no result from ${browser}.`, {
            exitCode: run.exitCode,
            stderr: run.stderr.toString().slice(0, 2000),
            dom: dom.slice(0, 2000)
        });
    }

    type Result = {
        documentAll: {
            typeofIsUndefined: boolean;
            strictEqualsUndefined: boolean;
            looseEqualsNull: boolean;
        };
        valueCount: number;
        mappedPairs: number;
        mappedMismatches: unknown[];
        excludedAgreeingOnDocumentAll: string[];
        excludedMismatchesWithoutDocumentAll: unknown[];
        isEmptyLikeDocumentAll: boolean;
    };
    const result = JSON.parse(text) as Result;

    const { documentAll } = result;
    if (
        !documentAll.typeofIsUndefined ||
        documentAll.strictEqualsUndefined ||
        !documentAll.looseEqualsNull
    ) {
        fail("this engine has no special document.all to test.", documentAll);
    }
    if (result.mappedMismatches.length > 0) {
        fail(
            "a check the rule rewrites disagrees with its guard.",
            result.mappedMismatches
        );
    }
    if (result.excludedAgreeingOnDocumentAll.length > 0) {
        fail(
            "a check excluded for document.all agrees with its guard there; the exclusion is wrong.",
            result.excludedAgreeingOnDocumentAll
        );
    }
    if (result.excludedMismatchesWithoutDocumentAll.length > 0) {
        fail(
            "an excluded check disagrees on a value other than document.all; the reason given is wrong.",
            result.excludedMismatchesWithoutDocumentAll
        );
    }

    console.log(
        `Browser equivalence check passed in ${browser}: ${result.mappedPairs} rewritten checks agree with their guards on ${result.valueCount} values, document.all included; typeof "undefined", == null and the typeof pair differ on document.all only. isEmptyLike(document.all) is ${String(result.isEmptyLikeDocumentAll)}.`
    );
} finally {
    await rm(directory, { recursive: true, force: true });
}
