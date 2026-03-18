import { publicPackages } from "./public-packages.mjs";

for (const pkg of publicPackages) {
  console.log(`Dry-running ${pkg.name} for npm...`);

  await Bun.$`bun run build`.cwd(pkg.dir);
  await Bun.$`npm pack --dry-run`.cwd(pkg.dir);
}
