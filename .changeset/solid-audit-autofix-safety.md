---
"@murky-web/oxlint-plugin-solid": minor
---

Audit fixes. `solid/validate-jsx-nesting` is implemented now (it did nothing):
the shared config enables it as `error`, so projects that update start to get
reports for `<p><div /></p>`, a link in a link, a row without a row group and
the like (`<template>` content is not checked). It uses the table of invalid
pairs of `validate-html-nesting` and a hand-written table of what the HTML
parser repairs instead of parse5. `solid/jsx-no-script-url` now matches
`javascript:` URLs with a tab, newline or control character in front of or
inside the scheme (the pattern was an escaped string and matched none of them)
and no longer flags `ABCjavascript:`. `solid/prefer-arrow-components` writes
valid code for `export default function` (a `const` plus
`export default Name;`), adds one `solid-js` type import at the top of the file
instead of one next to every component, and only reports (no fix) a function
that is read before its declaration, where the `const` would throw a
ReferenceError. `solid/no-destructure` expands a shorthand property (`{ title }`
becomes `{ title: props.title }`), picks a props name that no enclosing scope
and no function around a rewritten read uses (`props2`) and only reports a
nested pattern, a computed key that is not a literal or a write to a
destructured name. `solid/imports` keeps a value specifier out of an
`import type` declaration, writes a type specifier as `type Name` in a value
import, or without `type` in a type import (TS1361, TS1484, TS2206), and no
longer leaves a dangling comma when it moves the last specifier.
`solid/prefer-class-object` no longer writes a second `class` attribute for
`classList` next to `class`. `solid/event-handlers` no longer suggests the
`attr:` namespace, which Solid 2.0 removed. `solid/no-server-import-in-client`
finds the project root as the nearest folder that holds `src/server` (not the
nearest `package.json`) and stops at the first folder with a `.git` or a
package.json with `workspaces`, reads the directive prologue properly
(`"use strict"; "use server";` is a server module, `"use server".length;` is
not) and also checks `require("...")` and template literals in `import()`.
