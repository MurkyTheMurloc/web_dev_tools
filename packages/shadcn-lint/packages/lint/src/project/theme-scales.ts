// Reads the theme scales a project's stylesheets declare, the way `cn
// build` registers them: `--radius-card` in `@theme` adds `card` to the
// radius scale, and `--radius-*: initial` replaces the default scale with
// the declared names. Only `@theme` blocks are read. `@import`s are
// followed, relative ones and packages (`@import "@workspace/ui/globals.css"`
// through `node_modules`, resolved the way cn resolves them).
//
// A port of cn's `themeFromCss` (packages/cn/src/theme-css.ts), which cn
// 0.5.2 does not export. Kept in step with it so the linter and the
// project's runtime `cn` read one theme the same way; replace with the
// import once cn exports it.

import { readFileSync, realpathSync, statSync } from "node:fs"
import * as path from "node:path"
import type { ClassGroupDef, ConfigExtension } from "cn/compiler"

// Tailwind namespace to cn theme scale. Longest first, so `--text-shadow-x`
// is a text shadow and `--font-weight-x` a weight. `--color-*` and
// `--font-*` are left out: cn already accepts any name on those scales.
const NAMESPACES: [string, string][] = [
  ["inset-shadow", "inset-shadow"],
  ["drop-shadow", "drop-shadow"],
  ["text-shadow", "text-shadow"],
  ["font-weight", "font-weight"],
  ["perspective", "perspective"],
  ["breakpoint", "breakpoint"],
  ["container", "container"],
  ["tracking", "tracking"],
  ["spacing", "spacing"],
  ["leading", "leading"],
  ["animate", "animate"],
  ["radius", "radius"],
  ["shadow", "shadow"],
  ["aspect", "aspect"],
  ["blur", "blur"],
  ["ease", "ease"],
  ["text", "text"],
]

// Strings are kept intact, so a `/*` inside one is not a comment. A comment
// left open runs to the end of the file.
function stripComments(css: string) {
  return css.replace(
    /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')|\/\*[\s\S]*?(?:\*\/|$)/g,
    (_, string: string | undefined) => string ?? ""
  )
}

// Every declaration directly inside an `@theme` block, as [property, value].
// Nested blocks such as `@keyframes` are skipped, and the declarations after
// them are still read. `;`, `{` and `}` inside a quoted value are text.
function themeDeclarations(css: string) {
  const declarations: [string, string][] = []
  const theme: boolean[] = []
  let start = 0
  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '"' || char === "'") {
      for (i++; i < css.length && css[i] !== char; i++) {
        if (css[i] === "\\") i++
      }
    } else if (char === "{") {
      theme.push(/^@theme\b/.test(css.slice(start, i).trim()))
      start = i + 1
    } else if (char === ";" || char === "}") {
      if (theme.at(-1)) {
        const declaration = css.slice(start, i)
        const colon = declaration.indexOf(":")
        if (colon !== -1) {
          declarations.push([
            declaration.slice(0, colon).trim(),
            declaration.slice(colon + 1).trim(),
          ])
        }
      }
      if (char === "}") theme.pop()
      start = i + 1
    }
  }
  return declarations
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFile(file: string) {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

function readPackage(dir: string) {
  try {
    const manifest: unknown = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf8")
    )
    return isRecord(manifest) ? manifest : null
  } catch {
    return null
  }
}

// The stylesheet an `exports` target names: the `style` condition, else
// `default`.
function conditionTarget(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value.map((entry) => conditionTarget(entry)).find(Boolean) ?? null
  }
  if (isRecord(value)) {
    for (const [condition, target] of Object.entries(value)) {
      if (condition === "style" || condition === "default") {
        const found = conditionTarget(target)
        if (found) return found
      }
    }
  }
  return null
}

// A package's `exports` entry for `subpath` (`.` or `./globals.css`), an
// exact key first, then the most specific `*` pattern.
function exportTarget(exports: unknown, subpath: string) {
  if (
    !isRecord(exports) ||
    !Object.keys(exports).some((key) => key.startsWith("."))
  ) {
    return subpath === "." ? conditionTarget(exports) : null
  }
  if (subpath in exports) return conditionTarget(exports[subpath])
  const key = Object.keys(exports)
    .filter((candidate) => {
      const [prefix, suffix] = candidate.split("*")
      return (
        suffix !== undefined &&
        subpath.startsWith(prefix) &&
        subpath.endsWith(suffix) &&
        subpath.length >= candidate.length
      )
    })
    .sort((a, b) => b.indexOf("*") - a.indexOf("*"))[0]
  if (!key) return null
  const [prefix, suffix] = key.split("*")
  const match = subpath.slice(prefix.length, subpath.length - suffix.length)
  return conditionTarget(exports[key])?.replaceAll("*", match) ?? null
}

// The file an `@import` names, from the importing file: a relative path as
// written, a package through the nearest `node_modules` upward. Null for
// `tailwindcss`, a URL or a package that cannot be found, which cn skips too.
function resolveImport(spec: string, from: string) {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return path.resolve(path.dirname(from), spec)
  }
  const match = /^((?:@[\w.-]+\/)?[\w.-]+)(\/.*)?$/.exec(spec)
  if (!match || match[1] === "tailwindcss") return null
  const [, name, subpath = ""] = match
  for (let dir = path.dirname(from); ; dir = path.dirname(dir)) {
    const root = path.join(dir, "node_modules", name)
    const manifest = readPackage(root)
    if (manifest) {
      let file: string | undefined
      if (manifest.exports !== undefined) {
        const target = exportTarget(manifest.exports, `.${subpath}`)
        file = target ? path.join(root, target) : undefined
      } else {
        const style = typeof manifest.style === "string" ? manifest.style : ""
        const candidate = path.join(root, subpath || style || "index.css")
        file = isFile(candidate) ? candidate : `${candidate}.css`
      }
      return file && isFile(file) ? realpathSync(file) : null
    }
    if (path.dirname(dir) === dir) return null
  }
}

function importSpecs(css: string) {
  return Array.from(
    css.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g),
    (match) => match[1]
  )
}

// The theme scales declared in the stylesheets and the files they import,
// as a config extension: declared names under `extend`, and scales reset
// with `--<namespace>-*: initial` under `override`. A reset discards the
// names declared before it, and a declared `--spacing` keeps numeric
// spacing (`p-4`) through a spacing reset. Each entry is read as its own
// tree, and an entry another entry imports is left to that one, as cn does.
// Also returns every file read, so a cache can re-read when one changes.
// Throws when a stylesheet cannot be read.
export function themeScalesFromCss(entries: readonly string[]) {
  const trees = entries.map((file) => {
    const entry = path.resolve(file)
    const files: string[] = []
    const declarations: [string, string][] = []
    const visit = (target: string) => {
      if (files.includes(target)) return
      files.push(target)
      let css
      try {
        css = stripComments(readFileSync(target, "utf8"))
      } catch (error) {
        throw new Error(
          `cannot read css ${target === entry ? target : `${target} (imported from ${entry})`}: ${(error as Error).message}`,
          { cause: error }
        )
      }
      for (const spec of importSpecs(css)) {
        const imported = resolveImport(spec, target)
        if (imported) visit(imported)
      }
      declarations.push(...themeDeclarations(css))
    }
    visit(entry)
    return { files, declarations }
  })
  const partial = (tree: (typeof trees)[number]) =>
    trees.some(
      (other) =>
        other !== tree &&
        other.files.includes(tree.files[0]) &&
        !tree.files.includes(other.files[0])
    )

  const names = new Map<string, Set<string>>()
  const reset = new Set<string>()
  let multiplier = false
  for (const tree of trees) {
    if (partial(tree)) continue
    const declared = new Map<string, Set<string>>()
    let spacing = false
    for (const [prop, value] of tree.declarations) {
      if (!prop.startsWith("--")) continue
      if (prop === "--*") {
        if (value === "initial") {
          for (const [, scale] of NAMESPACES) reset.add(scale)
          declared.clear()
          spacing = false
        }
        continue
      }
      if (prop === "--spacing") {
        spacing = value !== "initial"
        continue
      }
      const namespace = NAMESPACES.find(([ns]) => prop.startsWith(`--${ns}-`))
      if (!namespace) continue
      const [ns, scale] = namespace
      const name = prop.slice(ns.length + 3)
      if (name === "*") {
        if (value === "initial") {
          reset.add(scale)
          declared.delete(scale)
          if (scale === "spacing") spacing = false
        }
        continue
      }
      // `--text-display--line-height` is a sub-property of `display`.
      if (!name || name.includes("--")) continue
      if (value === "initial") {
        declared.get(scale)?.delete(name)
        continue
      }
      let set = declared.get(scale)
      if (!set) declared.set(scale, (set = new Set()))
      set.add(name)
    }
    for (const [scale, set] of declared) {
      names.set(scale, new Set([...(names.get(scale) ?? []), ...set]))
    }
    multiplier ||= spacing
  }

  const extend: Record<string, ClassGroupDef[]> = {}
  const override: Record<string, ClassGroupDef[]> = {}
  for (const [scale, set] of names) {
    if (!reset.has(scale)) extend[scale] = [...set]
  }
  for (const scale of reset) override[scale] = [...(names.get(scale) ?? [])]
  // A reset spacing scale still has `px`, and the numbers while `--spacing`
  // is declared, as in Tailwind.
  if (override.spacing) {
    override.spacing.unshift("px", ...(multiplier ? [{ $v: "isNumber" }] : []))
  }
  const extension: ConfigExtension = {}
  if (Object.keys(extend).length) extension.extend = { theme: extend }
  if (Object.keys(override).length) extension.override = { theme: override }
  return {
    extension,
    files: [...new Set(trees.flatMap((tree) => tree.files))],
  }
}
