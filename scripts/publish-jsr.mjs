import { publicPackages } from "./public-packages.mjs";

// Pinned: an unpinned `jsr` would download whatever is newest at publish time.
const jsrCli = "jsr@0.14.3";

const dryRun = process.argv.includes("--dry-run");

for (const pkg of publicPackages.filter((publicPackage) => {
  return publicPackage.publishToJsr;
})) {
  console.log(`${dryRun ? "Dry-running" : "Publishing"} ${pkg.name} to JSR...`);

  if (dryRun) {
    await Bun.$`bunx ${jsrCli} publish --dry-run --allow-dirty`.cwd(pkg.dir);
    continue;
  }

  await Bun.$`bunx ${jsrCli} publish`.cwd(pkg.dir);
}
