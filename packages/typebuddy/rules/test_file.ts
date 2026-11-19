// Directory names whose contents are test code, matched as whole path
// segments: `src/__tests__/x.ts` and `tests/helper.ts` count, `src/latest/x.ts`
// and `src/testing/x.ts` do not.
const TEST_DIRECTORIES = new Set(["__mocks__", "__tests__", "test", "tests"]);

// `x.test.ts`, `x.spec.tsx`, `x.bench.ts`: the marker has to be its own dot
// segment, so `latest.ts` and `contest.ts` stay source files.
const TEST_FILE_NAME = /\.(?:bench|spec|test)\.[^.]+/;

// Test setup files by name: `vitest.setup.*`, `vitest-setup.*` and the
// Jest-style `setupTests.*`.
const SETUP_FILE_NAME = /^(?:setupTests|vitest-setup|vitest\.setup)\.[^.]+$/;

const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:\/)/;

function toSlashes(path: string): string {
    return path.replaceAll("\\", "/");
}

/**
 * The directory segments of `filename` that count for the directory match: the
 * ones below the project's working directory `cwd`. A relative filename is
 * relative to the project already. An absolute one needs `cwd` to tell the
 * project's own directories from the ones above it (`/tmp/test/app/src/x.ts` is
 * not under a test directory); without `cwd`, or outside it, no directory
 * counts, so the mistake is a test helper that gets linted, never a whole
 * project that goes silent.
 */
function projectDirectories(path: string, cwd: string | undefined): string[] {
    const segments = path.split("/");
    segments.pop();

    if (!ABSOLUTE_PATH.test(path)) {
        return segments;
    }
    if (cwd === undefined) {
        return [];
    }

    const root = toSlashes(cwd).replace(/\/+$/, "");
    if (root === "" || !path.startsWith(`${root}/`)) {
        return [];
    }

    return path
        .slice(root.length + 1)
        .split("/")
        .slice(0, -1);
}

/**
 * Whether `filename` is test code: test, spec and bench files, files under a
 * `__tests__`, `tests`, `test` or `__mocks__` directory of the project rooted
 * at `cwd`, and test setup files. Both `/` and `\` separate path segments.
 */
function isTestFile(filename: string, cwd?: string): boolean {
    const path = toSlashes(filename);
    const baseName = path.slice(path.lastIndexOf("/") + 1);

    return (
        TEST_FILE_NAME.test(baseName) ||
        SETUP_FILE_NAME.test(baseName) ||
        projectDirectories(path, cwd).some((segment) =>
            TEST_DIRECTORIES.has(segment),
        )
    );
}

// The rules type their context by what they use (`getSourceCode`, `report`),
// which leaves out what oxlint's JS plugin API puts on every context: the
// absolute `filename` and the `cwd` oxlint runs in.
function getFilename(context: object): string {
    if ("filename" in context && typeof context.filename === "string") {
        return context.filename;
    }

    return "";
}

function getCwd(context: object): string | undefined {
    if ("cwd" in context && typeof context.cwd === "string") {
        return context.cwd;
    }

    return undefined;
}

/**
 * Make a rule a no-op for test files: its `create` returns no visitors, so test
 * helpers, fixtures and mocks are not asked to follow the typebuddy conventions
 * (`MaybePromise` results, `Maybe`/`Nullable`/`Optional` types).
 */
function withoutTestFiles<
    Context extends object,
    Visitors extends object,
    Rest,
>(
    rule: Rest & { create(context: Context): Visitors },
): Omit<Rest, "create"> & {
    create(context: Context): Visitors | Record<string, never>;
} {
    return {
        ...rule,
        create(context: Context): Visitors | Record<string, never> {
            if (isTestFile(getFilename(context), getCwd(context))) {
                return {};
            }

            return rule.create(context);
        },
    };
}

export { isTestFile, withoutTestFiles };
