import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const smokeDir = new URL("./", import.meta.url);
const configPath = new URL("./.oxlintrc.jsonc", smokeDir);
const formatConfigPath = new URL(
    "../../../config/oxc/.oxfmtrc.jsonc",
    smokeDir,
);

// Two shapes, because the import insertion behaves differently in each: a file
// that already imports something gets the helper appended after the last
// import, one that does not gets it prepended before the first statement.
const cases = [
    { input: "./fix-input.ts", expected: "./fix-expected.ts" },
    { input: "./fix-input-bare.ts", expected: "./fix-expected-bare.ts" },
] as const;

async function runCase(input: string, expected: string): Promise<void> {
    const sourcePath = new URL(input, smokeDir);
    const expectedPath = new URL(expected, smokeDir);

    const tempDir = await mkdtemp(join(tmpdir(), "typebuddy-oxlint-fix-"));
    const tempFilePath = join(tempDir, "fixture.ts");

    try {
        const source = await readFile(sourcePath, "utf8");
        await writeFile(tempFilePath, source, "utf8");

        let previous = source;

        for (let pass = 0; pass < 6; pass += 1) {
            const result =
                await Bun.$`oxlint -c ${configPath.pathname} --fix ${tempFilePath}`
                    .quiet()
                    .nothrow();

            if (![0, 1].includes(result.exitCode)) {
                console.error(
                    `Oxlint fix smoke test failed unexpectedly on ${input}.`,
                );
                process.exit(result.exitCode);
            }

            const next = await readFile(tempFilePath, "utf8");
            if (next === previous) {
                break;
            }

            previous = next;
        }

        await Bun.$`oxfmt -c ${formatConfigPath.pathname} ${tempFilePath}`.quiet();

        const [actual, want] = await Promise.all([
            readFile(tempFilePath, "utf8"),
            readFile(expectedPath, "utf8"),
        ]);

        if (actual !== want) {
            console.error(
                `Oxlint fix smoke test did not produce the expected output for ${input}.`,
            );
            console.error("\n--- Expected ---\n");
            console.error(want);
            console.error("\n--- Actual ---\n");
            console.error(actual);
            process.exit(1);
        }
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

for (const { input, expected } of cases) {
    await runCase(input, expected);
}

console.log(`Oxlint fix smoke test passed (${cases.length} fixtures).`);
