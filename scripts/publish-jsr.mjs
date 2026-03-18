import { publicPackages } from "./public-packages.mjs";

const dryRun = process.argv.includes("--dry-run");

for (const pkg of publicPackages) {
  console.log(`${dryRun ? "Dry-running" : "Publishing"} ${pkg.name} to JSR...`);

  if (dryRun) {
    await Bun.$`npx jsr publish --dry-run --allow-dirty`.cwd(pkg.dir);
    continue;
  }

  await Bun.$`npx jsr publish`.cwd(pkg.dir);
}
