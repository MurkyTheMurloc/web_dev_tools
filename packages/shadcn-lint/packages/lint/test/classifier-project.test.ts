import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { categoryOf } from "../src/grammar/categories"
import {
  BUNDLED_CN,
  classifierFor,
  groupOf,
  resolveCnConfig,
  themedCnConfig,
} from "../src/grammar/classifier"
import { resetFsMemo } from "../src/project/fs"
import {
  animationGroupFor,
  projectClassifierFor,
} from "../src/project/namespaces"
import { themeScalesFromCss } from "../src/project/theme-scales"
import { resetWarnings, setWarningSink } from "../src/project/warn"

describe("animate values, from cn's grammar", () => {
  test.each(["animate-spin", "animate-none", "hover:animate-pulse"])(
    "%s classifies as animate (motion)",
    (token) => {
      expect(groupOf(token)).toBe("animate")
      expect(categoryOf(groupOf(token))).toBe("motion")
    }
  )
})

// cn groups only Tailwind's own animations, so a project's animation is
// read from its CSS. These hold whichever cn grammar is installed.
const PAGE_IN_NAMESPACE_THEME = path.join(
  __dirname,
  "fixtures/namespace-theme/app/page.tsx"
)

describe("animate values, from the project's CSS", () => {
  const PAGE = PAGE_IN_NAMESPACE_THEME

  test.each([
    "animate-shimmer",
    "animate-in",
    "data-[state=open]:animate-in",
    "animate-in!",
    "animate-duration-500",
  ])("%s classifies as animate (motion)", (token) => {
    expect(animationGroupFor(PAGE, token)).toBe("animate")
    const group = projectClassifierFor(PAGE).groupOf(token)
    expect(group).toBe("animate")
    expect(categoryOf(group)).toBe("motion")
  })

  test.each(["animate-wiggle", "animate-[spin_1s]", "fade-in", "text-sm"])(
    "%s is not a project animation",
    (token) => {
      expect(animationGroupFor(PAGE, token)).toBeNull()
    }
  )

  test("no file means no project to read", () => {
    expect(animationGroupFor(undefined, "animate-shimmer")).toBeNull()
  })
})

// cn build registers the scales a theme declares, so the project's cn
// merges rounded-card with rounded-lg. The classifier reads the same
// theme, so a contract that allows shape accepts rounded-card too.
describe("theme scales, from the project's CSS", () => {
  const PAGE = PAGE_IN_NAMESPACE_THEME
  const RESET = path.join(__dirname, "fixtures/reset-theme/app/page.tsx")

  test.each([
    ["rounded-card", "rounded-lg"],
    ["p-gutter", "p-4"],
    ["tracking-display", "tracking-tight"],
    ["leading-display", "leading-tight"],
    // A breakpoint names a screen width, not a max-width step.
    ["max-w-screen-wide", "max-w-screen-md"],
    ["columns-prose", "columns-3"],
    ["ease-snappy", "ease-in"],
    ["blur-glass", "blur-sm"],
    ["perspective-stage", "perspective-near"],
    ["aspect-poster", "aspect-video"],
    ["hover:rounded-card", "hover:rounded-lg"],
    ["text-stat-label", "text-sm"],
    ["shadow-card-glow", "shadow-lg"],
    ["drop-shadow-lift", "drop-shadow-lg"],
  ])("%s classifies with %s", (custom, standard) => {
    const group = groupOf(custom, PAGE)
    expect(group).not.toBeNull()
    expect(group).toBe(groupOf(standard, PAGE))
    expect(categoryOf(group)).toBe(categoryOf(groupOf(standard, PAGE)))
    expect(projectClassifierFor(PAGE).groupOf(custom)).toBe(group)
  })

  test("rounded-card is shape", () => {
    expect(categoryOf(groupOf("rounded-card", PAGE))).toBe("shape")
  })

  test.each(["rounded-nope", "rounded-panel", "p-nope"])(
    "%s is not declared, so it stays unclassified",
    (token) => {
      expect(groupOf(token, PAGE)).toBeNull()
      expect(projectClassifierFor(PAGE).groupOf(token)).toBeNull()
    }
  )

  test("without a file there is no theme to read", () => {
    expect(groupOf("rounded-card")).toBeNull()
    expect(groupOf("rounded-card", "/nonexistent/app/page.tsx")).toBeNull()
  })

  test("every file in the project shares one classifier", () => {
    const other = path.join(path.dirname(PAGE), "other.tsx")
    expect(classifierFor(PAGE)).toBe(classifierFor(other))
    expect(classifierFor(PAGE)).not.toBe(classifierFor(RESET))
    expect(themedCnConfig(PAGE)).not.toBe(resolveCnConfig(PAGE))
  })

  test("a reset replaces the default names with the declared ones", () => {
    expect(groupOf("rounded-lg", RESET)).toBeNull()
    expect(groupOf("rounded-fresh", RESET)).toBe("rounded")
    expect(groupOf("text-sm", RESET)).toBe("font-size")
    expect(groupOf("text-lg", RESET)).not.toBe("font-size")
    // Untouched scales keep their defaults.
    expect(groupOf("p-4", RESET)).toBe("p")
  })
})

describe("theme scales refresh and fail safe", () => {
  const directories = new Set<string>()
  const warnings: string[] = []

  function createProject(theme: string) {
    const root = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), "lint-theme-scales-"))
    )
    directories.add(root)
    const write = (name: string, source: string) => {
      const file = path.join(root, name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, source)
      fs.utimesSync(file, new Date(Date.now()), new Date(Date.now()))
      return file
    }
    write("package.json", JSON.stringify({ private: true }))
    write(
      "components.json",
      JSON.stringify({
        aliases: { ui: "@/components/ui" },
        tailwind: { css: "theme.css" },
      })
    )
    write("theme.css", theme)
    return { write, page: path.join(root, "page.tsx") }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    setWarningSink((m) => warnings.push(m))
  })

  afterEach(() => {
    vi.useRealTimers()
    resetFsMemo()
    resetWarnings()
    warnings.length = 0
    for (const dir of directories) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    directories.clear()
  })

  test("an edited theme is re-read", () => {
    const { write, page } = createProject("@theme { --radius-card: 8px; }")
    const before = classifierFor(page)
    expect(groupOf("rounded-card", page)).toBe("rounded")
    expect(groupOf("rounded-panel", page)).toBeNull()

    vi.setSystemTime(Date.now() + 1500)
    write("theme.css", "@theme { --radius-panel: 8px; }")
    expect(groupOf("rounded-panel", page)).toBe("rounded")
    expect(groupOf("rounded-card", page)).toBeNull()
    expect(classifierFor(page)).not.toBe(before)

    // Unchanged files keep the classifier they had.
    vi.setSystemTime(Date.now() + 1500)
    expect(classifierFor(page)).toBe(classifierFor(page))
  })

  // cn 0.5.0: a reset discards the names declared before it.
  test("a reset discards the names declared before it", () => {
    const { page } = createProject(
      "@theme { --radius-old: 4px; --radius-*: initial; --radius-fresh: 1rem; }"
    )
    expect(groupOf("rounded-old", page)).toBeNull()
    expect(groupOf("rounded-fresh", page)).toBe("rounded")
  })

  test("--*: initial discards every name declared before it", () => {
    const { page } = createProject(
      "@theme { --radius-old: 4px; --*: initial; --radius-fresh: 1rem; }"
    )
    expect(groupOf("rounded-old", page)).toBeNull()
    expect(groupOf("rounded-fresh", page)).toBe("rounded")
  })

  // cn 0.5.0: a declaration after a nested block such as @keyframes is read.
  test("a declaration after a nested block is read", () => {
    const { page } = createProject(
      "@theme { --radius-before: 1px; @keyframes fade { from { opacity: 0; } to { opacity: 1; } } --radius-after: 2px; }"
    )
    expect(groupOf("rounded-before", page)).toBe("rounded")
    expect(groupOf("rounded-after", page)).toBe("rounded")
  })

  // cn 0.5.2: a declared --spacing keeps numeric spacing through a reset.
  test("--spacing keeps numeric spacing through a spacing reset", () => {
    const { page } = createProject(
      "@theme { --spacing-*: initial; --spacing: 0.25rem; --spacing-gutter: 1rem; }"
    )
    expect(groupOf("p-4", page)).toBe("p")
    expect(groupOf("p-px", page)).toBe("p")
    expect(groupOf("p-gutter", page)).toBe("p")
  })

  test("a spacing reset without --spacing keeps only px and the declared names", () => {
    const { page } = createProject(
      "@theme { --spacing-*: initial; --spacing-gutter: 1rem; }"
    )
    expect(groupOf("p-4", page)).toBeNull()
    expect(groupOf("p-px", page)).toBe("p")
    expect(groupOf("p-gutter", page)).toBe("p")
  })

  test("--spacing: initial after a declaration removes numeric spacing again", () => {
    const { page } = createProject(
      "@theme { --spacing-*: initial; --spacing: 0.25rem; --spacing: initial; }"
    )
    expect(groupOf("p-4", page)).toBeNull()
  })

  // cn 0.5.0 follows `@import`s of packages, the usual monorepo setup.
  describe("package imports", () => {
    const IMPORT = '@import "tailwindcss"; @import "@workspace/ui/globals.css";'
    const CARD = "@theme { --radius-card: 1px; }"

    test("an exports entry is followed", () => {
      const { write, page } = createProject(IMPORT)
      write(
        "node_modules/@workspace/ui/package.json",
        JSON.stringify({ exports: { "./globals.css": "./src/globals.css" } })
      )
      write("node_modules/@workspace/ui/src/globals.css", CARD)
      expect(groupOf("rounded-card", page)).toBe("rounded")
      expect(warnings).toEqual([])
    })

    test("an exports pattern and its style condition are followed", () => {
      const { write, page } = createProject(IMPORT)
      write(
        "node_modules/@workspace/ui/package.json",
        JSON.stringify({
          exports: {
            "./*": { types: "./types/*.d.ts", style: "./src/*" },
          },
        })
      )
      write("node_modules/@workspace/ui/src/globals.css", CARD)
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("without exports the subpath is read from the package folder", () => {
      const { write, page } = createProject(IMPORT)
      write("node_modules/@workspace/ui/package.json", "{}")
      write("node_modules/@workspace/ui/globals.css", CARD)
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("a bare import reads the package's style entry", () => {
      const { write, page } = createProject(
        '@import "tailwindcss"; @import "@workspace/ui";'
      )
      write(
        "node_modules/@workspace/ui/package.json",
        JSON.stringify({ style: "theme/index.css" })
      )
      write("node_modules/@workspace/ui/theme/index.css", CARD)
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("node_modules is looked up from the importing file upward", () => {
      const { write, page } = createProject(
        '@import "tailwindcss"; @import "./deep/inner/more.css";'
      )
      write("deep/inner/more.css", '@import "@workspace/ui/globals.css";')
      write("node_modules/@workspace/ui/package.json", "{}")
      write("node_modules/@workspace/ui/globals.css", CARD)
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("the package's own imports and a cycle back are followed once", () => {
      const { write, page } = createProject(IMPORT)
      write("node_modules/@workspace/ui/package.json", "{}")
      write(
        "node_modules/@workspace/ui/globals.css",
        '@import "./tokens.css"; @import "@workspace/ui/globals.css";'
      )
      write(
        "node_modules/@workspace/ui/tokens.css",
        '@import "./globals.css"; @theme { --radius-card: 1px; }'
      )
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("a package that cannot be resolved is skipped without a warning", () => {
      const { write, page } = createProject(IMPORT)
      write(
        "theme.css",
        `${IMPORT} @import "tailwindcss/theme.css"; @theme { --radius-own: 1px; }`
      )
      expect(groupOf("rounded-card", page)).toBeNull()
      expect(groupOf("rounded-own", page)).toBe("rounded")
      expect(warnings).toEqual([])
    })

    test("a package whose exports do not list the subpath is skipped", () => {
      const { write, page } = createProject(IMPORT)
      write(
        "node_modules/@workspace/ui/package.json",
        JSON.stringify({ exports: { "./other.css": "./other.css" } })
      )
      write("node_modules/@workspace/ui/globals.css", CARD)
      expect(groupOf("rounded-card", page)).toBeNull()
    })
  })

  // A quoted value can hold the characters that structure a stylesheet.
  describe("strings and comments", () => {
    test("a comment opener inside a string does not start a comment", () => {
      const { page } = createProject(
        '@theme { --font-sans: "a/*"; --radius-card: 1px; --font-mono: "*/b"; }'
      )
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("; { and } inside a quoted value do not end the declaration or block", () => {
      const { page } = createProject(
        `@theme { --font-sans: "a;b}{"; --font-mono: 'it\\'s;}'; --radius-card: 1px; }`
      )
      expect(groupOf("rounded-card", page)).toBe("rounded")
    })

    test("a comment left open ends at the end of the file", () => {
      const { page } = createProject(
        "@theme { --radius-card: 1px; --radius-lost: 2px; /* --radius-gone: 3px; } /* never closed"
      )
      expect(groupOf("rounded-card", page)).toBe("rounded")
      expect(groupOf("rounded-lost", page)).toBe("rounded")
      expect(groupOf("rounded-gone", page)).toBeNull()
    })

    test("a closed comment inside @theme hides its declarations", () => {
      const { page } = createProject(
        "@theme { /* --radius-gone: 3px; */ --radius-card: 1px; }"
      )
      expect(groupOf("rounded-card", page)).toBe("rounded")
      expect(groupOf("rounded-gone", page)).toBeNull()
    })
  })

  test("a reset in one entry stylesheet does not drop another entry's names", () => {
    const { write, page } = createProject("@theme { --radius-one: 1px; }")
    const second = write("second.css", "@theme { --radius-*: initial; }")
    const theme = themeScalesFromCss([
      path.join(path.dirname(page), "theme.css"),
      second,
    ])
    expect(theme.extension.override?.theme?.radius).toEqual(["one"])
  })

  test("an unreadable import warns once and leaves the grammar alone", () => {
    const { page } = createProject(
      `@import "./missing.css";\n@theme { --radius-card: 8px; }`
    )
    expect(groupOf("rounded-card", page)).toBeNull()
    expect(groupOf("rounded-lg", page)).toBe("rounded")
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("missing.css")
    groupOf("rounded-card", path.join(path.dirname(page), "other.tsx"))
    expect(warnings).toHaveLength(1)
  })
})

describe("resolveCnConfig", () => {
  test("falls back to the bundled config where cn is not installed", () => {
    const config = resolveCnConfig("/nonexistent/project/app/page.tsx")
    expect(Object.keys(config.classGroups).length).toBeGreaterThan(300)
  })

  test("resolves the installed cn from the linted file upward", () => {
    const fromFile = path.join(__dirname, "fixtures/registry-corpus.json")
    const config = resolveCnConfig(fromFile)
    expect(Object.keys(config.classGroups).length).toBeGreaterThan(300)
    // The workspace cn is the bundled version, so its grammar is used as is.
    expect(config.classGroups["contain-size"]).toBeDefined()
  })

  test("BUNDLED_CN is the cn this package depends on", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
    ) as { dependencies: Record<string, string> }
    expect(pkg.dependencies.cn.replace(/^[\^~]/, "")).toBe(BUNDLED_CN)
  })

  // A fake cn at a chosen version: package.json plus a config.js that
  // `require("cn/config")` resolves without an exports map.
  function projectWithCn(version: string) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadcn-lint-cn-"))
    const pkg = path.join(root, "node_modules/cn")
    fs.mkdirSync(pkg, { recursive: true })
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({ name: "cn", version })
    )
    fs.writeFileSync(
      path.join(pkg, "config.js"),
      `module.exports = { defaultConfig: () => ({ classGroups: { "from-this-cn": ["x"] }, theme: {}, conflictingClassGroups: {}, conflictingClassGroupModifiers: {}, orderSensitiveModifiers: [] }) }`
    )
    return path.join(root, "app/page.tsx")
  }

  const warnings: string[] = []
  beforeEach(() => setWarningSink((m) => warnings.push(m)))
  afterEach(() => {
    warnings.length = 0
    resetWarnings()
  })

  test("uses the project's cn when it is at least the bundled version", () => {
    const config = resolveCnConfig(projectWithCn(BUNDLED_CN))
    expect(config.classGroups["from-this-cn"]).toBeDefined()
    expect(warnings).toEqual([])
  })

  test("an older project cn falls back to the bundled grammar, with one warning", () => {
    const file = projectWithCn("0.2.2")
    const config = resolveCnConfig(file)
    expect(config.classGroups["from-this-cn"]).toBeUndefined()
    expect(config.classGroups["contain-size"]).toBeDefined()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("cn is 0.2.2")
    expect(warnings[0]).toContain(`bundled cn ${BUNDLED_CN}`)
    // Another file in the same project shares the decision and the warning.
    resolveCnConfig(path.join(path.dirname(file), "other.tsx"))
    expect(warnings).toHaveLength(1)
  })

  test("one classifier per resolved config", () => {
    const a = classifierFor("/nonexistent/one/page.tsx")
    const b = classifierFor("/nonexistent/two/page.tsx")
    // Both fall back to the same bundled config object, so they share.
    expect(a).toBe(b)
  })
})
