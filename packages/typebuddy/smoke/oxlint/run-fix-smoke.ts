import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const smokeDir = new URL("./", import.meta.url);
const sourcePath = new URL("./fix-input.ts", smokeDir);
const expectedPath = new URL("./fix-expected.ts", smokeDir);
const configPath = new URL("./.oxlintrc.jsonc", smokeDir);

const tempDir = await mkdtemp(join(tmpdir(), "typebuddy-oxlint-fix-"));
const tempFilePath = join(tempDir, "fix-input.ts");

try {
  const input = await readFile(sourcePath, "utf8");
  await writeFile(tempFilePath, input, "utf8");

  await Bun.$`oxlint -c ${configPath.pathname} --fix ${tempFilePath}`.quiet();

  const [actual, expected] = await Promise.all([
    readFile(tempFilePath, "utf8"),
    readFile(expectedPath, "utf8"),
  ]);

  if (actual !== expected) {
    console.error("Oxlint fix smoke test did not produce the expected output.");
    console.error("\n--- Expected ---\n");
    console.error(expected);
    console.error("\n--- Actual ---\n");
    console.error(actual);
    process.exit(1);
  }

  console.log("Oxlint fix smoke test passed.");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
