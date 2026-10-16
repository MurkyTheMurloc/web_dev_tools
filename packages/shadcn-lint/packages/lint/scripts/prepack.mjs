// Copies the README and LICENSE from the package root into the package for
// publishing. The README links to GitHub with absolute URLs, so it needs no
// rewriting.
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const ROOT = path.resolve(PKG_DIR, "../..")

fs.copyFileSync(path.join(ROOT, "README.md"), path.join(PKG_DIR, "README.md"))
fs.copyFileSync(path.join(ROOT, "LICENSE"), path.join(PKG_DIR, "LICENSE"))
