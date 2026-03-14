import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const smokeDir = path.resolve(import.meta.dir);
const outputDir = path.join(smokeDir, ".output");
const bundlePath = path.join(outputDir, "bundle.js");

rmSync(outputDir, { force: true, recursive: true });
mkdirSync(outputDir, { recursive: true });

const buildProcess = Bun.spawnSync(
    [
        "bun",
        "build",
        path.join(smokeDir, "entry.ts"),
        "--outfile",
        bundlePath,
        "--format",
        "esm",
        "--target",
        "browser",
    ],
    {
        cwd: path.resolve(smokeDir, "../.."),
        stderr: "pipe",
        stdout: "pipe",
    },
);

if (buildProcess.exitCode !== 0) {
    throw new Error(
        `Tree-shake smoke build failed:\n${new TextDecoder().decode(buildProcess.stderr)}`,
    );
}

const bundleSource = readFileSync(bundlePath, "utf8");

const requiredMarkers = ["function isString", "candidate.toUpperCase"];
for (const marker of requiredMarkers) {
    if (!bundleSource.includes(marker)) {
        throw new Error(`Expected bundled output to include marker: ${marker}`);
    }
}

const forbiddenMarkers = [
    "function parseArray",
    "function parseDomainName",
    "function isEmptyLike",
    "function parseInteger",
    "uuidRegex",
    "ulidRegex",
];

for (const marker of forbiddenMarkers) {
    if (bundleSource.includes(marker)) {
        throw new Error(
            `Expected bundled output to tree-shake away unrelated runtime code, but found: ${marker}`,
        );
    }
}

console.log("Tree-shake smoke passed.");
