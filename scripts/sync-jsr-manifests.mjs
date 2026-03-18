import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { publicPackages } from "./public-packages.mjs";

for (const pkg of publicPackages.filter((publicPackage) => {
  return publicPackage.publishToJsr;
})) {
  const packagePath = join(pkg.dir, "package.json");
  const jsrPath = join(pkg.dir, "jsr.json");

  const [packageJson, jsrJson] = await Promise.all([
    readFile(packagePath, "utf8").then((content) => JSON.parse(content)),
    readFile(jsrPath, "utf8").then((content) => JSON.parse(content)),
  ]);

  jsrJson.name = packageJson.name;
  jsrJson.version = packageJson.version;

  await writeFile(`${jsrPath}`, `${JSON.stringify(jsrJson, null, 2)}\n`, "utf8");
  console.log(`Synced ${jsrPath} to ${packageJson.version}.`);
}
