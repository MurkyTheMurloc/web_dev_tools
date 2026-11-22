// Runs eslint-plugin-solid's test cases (upstream/cases.json) through oxlint
// with our plugin and sorts every case that behaves differently into one of
// four buckets: an invalid case we do not report (missed), a valid case we do
// report (falsePositive), a fix that differs from upstream's output (fix), and
// code oxlint cannot parse (parseError).
//
//   bun upstream/run.mjs                    table per rule
//   bun upstream/run.mjs --write-baseline   accept the current state
import { spawnSync } from "node:child_process";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from "node:fs";
import { join } from "node:path";

const PACKAGE_DIR = decodeURIComponent(
    new URL("../", import.meta.url).pathname
);
const REPO_ROOT = join(PACKAGE_DIR, "../..");
const OXLINT = join(REPO_ROOT, "node_modules/.bin/oxlint");
const CASES_PATH = join(PACKAGE_DIR, "upstream/cases.json");
export const BASELINE_PATH = join(PACKAGE_DIR, "upstream/baseline.json");

// Our rule name -> upstream rule name, for every rule both plugins have.
// jsx-uses-vars is left out: upstream tests it through core no-unused-vars.
export const RULE_PAIRS = {
    "components-return-once": "components-return-once",
    "event-handlers": "event-handlers",
    imports: "imports",
    "jsx-no-duplicate-props": "jsx-no-duplicate-props",
    "jsx-no-script-url": "jsx-no-script-url",
    "jsx-no-undef": "jsx-no-undef",
    "no-array-handlers": "no-array-handlers",
    "no-destructure": "no-destructure",
    "no-innerhtml": "no-innerhtml",
    "no-module-scope-reactive-primitive": "no-module-scope-reactive-primitive",
    "no-proxy-apis": "no-proxy-apis",
    "no-react-deps": "no-react-deps",
    "no-react-specific-props": "no-react-specific-props",
    "no-unknown-namespaces": "no-unknown-namespaces",
    "no-write-in-pure-computation": "no-write-in-pure-computation",
    "prefer-class-object": "prefer-classlist",
    "prefer-for": "prefer-for",
    "prefer-show": "prefer-show",
    reactivity: "reactivity",
    "self-closing-comp": "self-closing-comp",
    "style-prop": "style-prop",
    "validate-jsx-nesting": "validate-jsx-nesting"
};

// Upstream's vitest.setup.js replaces trackImports so that a name with no
// import at all counts as imported from solid-js; most cases rely on it. The
// copy of our plugin the cases run against gets the same replacement.
const MOCK_TRACK_IMPORTS = `export function trackImports(
    fromModule = /^(?:solid-js|@solidjs\\/[a-z-]+)(?:\\/|$)/
) {
    const aliases = new Map();
    const blocked = new Set();
    function handleImportDeclaration(node) {
        const matches = fromModule.test(node.source.value);
        for (const specifier of node.specifiers) {
            if (specifier.type === "ImportSpecifier") {
                const imported = specifier.imported.name ?? specifier.imported.value;
                if (matches) {
                    aliases.set(imported, specifier.local.name);
                } else {
                    blocked.add(imported);
                }
            }
        }
    }
    function matchImport(imports, value) {
        const importList = Array.isArray(imports) ? imports : [imports];
        return importList.find((name) => {
            return aliases.has(name)
                ? aliases.get(name) === value
                : !blocked.has(name) && name === value;
        });
    }
    return { handleImportDeclaration, matchImport };
}

`;

function copyPluginWithMock(workDir) {
    const sourceDir = join(workDir, "plugin");
    cpSync(join(PACKAGE_DIR, "src"), sourceDir, { recursive: true });
    const utilsPath = join(sourceDir, "utils.mjs");
    const utils = readFileSync(utilsPath, "utf8");
    const start = utils.indexOf("export function trackImports(");
    const end = utils.indexOf("export function", start + 1);
    if (start === -1 || end === -1) {
        throw new Error(
            "trackImports not found in src/utils.mjs; update the mock in upstream/run.mjs"
        );
    }
    writeFileSync(
        utilsPath,
        utils.slice(0, start) + MOCK_TRACK_IMPORTS + utils.slice(end)
    );
    return join(sourceDir, "index.mjs");
}

function lint(dir, extraArgs = []) {
    const { CI: _ci, ...env } = process.env;
    const result = spawnSync(
        "bun",
        [
            "--bun",
            OXLINT,
            "-c",
            ".oxlintrc.json",
            "--no-ignore",
            "--format",
            "json",
            ...extraArgs,
            "."
        ],
        { cwd: dir, encoding: "utf8", env, maxBuffer: 1 << 28 }
    );
    if (extraArgs.length > 0) {
        return [];
    }
    try {
        return JSON.parse(result.stdout).diagnostics;
    } catch {
        throw new Error(
            `oxlint gave no JSON in ${dir}:\n${result.stdout}${result.stderr}`
        );
    }
}

function caseId(testCase) {
    return `${testCase.kind}:${testCase.file}:${testCase.line}`;
}

const ALL_CATEGORIES_OFF = Object.fromEntries(
    [
        "correctness",
        "nursery",
        "pedantic",
        "perf",
        "restriction",
        "style",
        "suspicious"
    ].map((category) => [category, "off"])
);

function runRule(ours, cases, pluginPath, workDir) {
    const dir = join(workDir, ours);
    mkdirSync(dir);
    const all = [
        ...cases.valid.map((testCase, index) => ({
            ...testCase,
            fileName: `v${index}.tsx`,
            kind: "valid"
        })),
        ...cases.invalid.map((testCase, index) => ({
            ...testCase,
            fileName: `i${index}.tsx`,
            kind: "invalid"
        }))
    ];
    const overrides = [];
    for (const testCase of all) {
        writeFileSync(join(dir, testCase.fileName), testCase.code);
        if (testCase.options) {
            overrides.push({
                files: [testCase.fileName],
                rules: { [`solid/${ours}`]: ["error", ...testCase.options] }
            });
        }
    }
    const config = {
        categories: ALL_CATEGORIES_OFF,
        jsPlugins: [pluginPath],
        overrides,
        plugins: [],
        rules: { [`solid/${ours}`]: "error" }
    };
    writeFileSync(join(dir, ".oxlintrc.json"), JSON.stringify(config));

    const hits = new Map();
    const parseErrors = new Set();
    for (const diagnostic of lint(dir)) {
        const fileName = diagnostic.filename.replace(/^.*\//u, "");
        if (diagnostic.code?.includes(`(${ours})`)) {
            hits.set(fileName, [
                ...(hits.get(fileName) ?? []),
                diagnostic.message
            ]);
        } else if (!diagnostic.code) {
            parseErrors.add(fileName);
        }
    }

    const fixDir = `${dir}__fix`;
    cpSync(dir, fixDir, { recursive: true });
    lint(fixDir, ["--fix"]);

    const result = { falsePositive: [], fix: [], missed: [], parseError: [] };
    const details = {};
    for (const testCase of all) {
        const id = caseId(testCase);
        details[id] = {
            code: testCase.code,
            messages: hits.get(testCase.fileName) ?? []
        };
        if (parseErrors.has(testCase.fileName)) {
            result.parseError.push(id);
            continue;
        }
        const reported = hits.has(testCase.fileName);
        if (testCase.kind === "valid" && reported) {
            result.falsePositive.push(id);
        }
        if (testCase.kind === "invalid" && !reported) {
            result.missed.push(id);
        }
        const expectsFix =
            testCase.kind === "invalid" &&
            typeof testCase.output === "string" &&
            testCase.output !== testCase.code;
        if (
            expectsFix &&
            readFileSync(join(fixDir, testCase.fileName), "utf8") !==
                testCase.output
        ) {
            result.fix.push(id);
        }
    }
    return { cases: all.length, details, result };
}

export function runUpstreamCases() {
    const { rules } = JSON.parse(readFileSync(CASES_PATH, "utf8"));
    // Inside the package so the plugin copy resolves its dependencies.
    const workDir = mkdtempSync(join(PACKAGE_DIR, ".upstream-"));
    try {
        const pluginPath = copyPluginWithMock(workDir);
        const report = {};
        for (const [ours, upstream] of Object.entries(RULE_PAIRS)) {
            report[ours] = runRule(ours, rules[upstream], pluginPath, workDir);
        }
        return report;
    } finally {
        rmSync(workDir, { force: true, recursive: true });
    }
}

export function toBaseline(report) {
    return Object.fromEntries(
        Object.entries(report).map(([rule, { result }]) => [rule, result])
    );
}

function main() {
    const report = runUpstreamCases();
    console.table(
        Object.fromEntries(
            Object.entries(report).map(([rule, { cases, result }]) => [
                rule,
                {
                    cases,
                    falsePositive: result.falsePositive.length,
                    fix: result.fix.length,
                    missed: result.missed.length,
                    parseError: result.parseError.length
                }
            ])
        )
    );
    const showIndex = process.argv.indexOf("--show");
    if (showIndex !== -1) {
        const { details, result } = report[process.argv[showIndex + 1]];
        for (const bucket of ["falsePositive", "missed", "fix"]) {
            for (const id of result[bucket]) {
                console.log(`\n### ${bucket} ${id}`);
                console.log(details[id].code.trim());
                for (const message of details[id].messages) {
                    console.log(`  -> ${message}`);
                }
            }
        }
    }
    if (process.argv.includes("--write-baseline")) {
        writeFileSync(
            BASELINE_PATH,
            `${JSON.stringify(toBaseline(report), null, 4)}\n`
        );
        console.log(`wrote ${BASELINE_PATH}`);
    }
}

if (import.meta.main) {
    main();
}
