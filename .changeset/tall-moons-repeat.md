---
"@murky-web/oxlint-plugin-solid": major
---

Target Solid 2.0. Solid moved its renderers into `@solidjs/*` packages and pulled the store APIs into the core, and the plugin assumed the 1.x layout throughout. The most consequential case was silent: the import tracker matched only `solid-js`, so every import-tracking rule went blind against `@solidjs/web` and stopped reporting rather than failing.

- `prefer-classlist` is renamed to `prefer-class-object`. It recommended `classlist`, which Solid 2.0 removed; it now moves the object onto `class`.
- `no-unknown-namespaces` accepted `on:`, `oncapture:`, `use:`, `prop:`, `attr:`, `bool:`, `class:` and `style:`. All are gone, so only the DOM's own `xmlns:`/`xlink:` remain.
- `no-proxy-apis` detected stores by the `solid-js/store` import path. Stores now live in the core that every file imports, so it matches the store API names instead.
- Reactivity tracking follows the renames: `batch`/`produce` → `flush`, `onMount` → `onSettled`, `createSelector` → `createProjection`, `mergeProps` → `merge`, `indexArray` → `repeat`, `useTransition` removed.
- `jsx-no-undef` auto-imports `Loading`/`Errored`/`Repeat`/`Reveal` instead of `Index`.

Known gap: the `no-destructure` autofix still emits `splitProps(mergeProps(...))`. `splitProps(props, ["a"])` became `omit(props, "a")`, which returns the rest object rather than `[picked, rest]` — a change of shape rather than a rename. The report is correct; only the fix produces Solid 1 code.

Projects still on Solid 1.x should pin `0.1.3`.
