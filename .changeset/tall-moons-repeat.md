---
"@murky-web/oxlint-plugin-solid": major
---

Target Solid 2.0. Solid moved its renderers into `@solidjs/*` packages and pulled the store APIs into the core, and the plugin assumed the 1.x layout throughout. The most consequential case was silent: the import tracker matched only `solid-js`, so every import-tracking rule went blind against `@solidjs/web` and stopped reporting rather than failing.

- `prefer-classlist` is renamed to `prefer-class-object`. It recommended `classlist`, which Solid 2.0 removed; it now moves the object onto `class`.
- `no-unknown-namespaces` accepted `on:`, `oncapture:`, `use:`, `prop:`, `attr:`, `bool:`, `class:` and `style:`. All are gone, so only the DOM's own `xmlns:`/`xlink:` remain.
- `no-proxy-apis` detected stores by the `solid-js/store` import path. Stores now live in the core that every file imports, so it matches the store API names instead.
- Reactivity tracking follows the renames: `batch`/`produce` → `flush`, `onMount` → `onSettled`, `createSelector` → `createProjection`, `mergeProps` → `merge`, `indexArray` → `repeat`, `useTransition` removed.
- `jsx-no-undef` auto-imports `Loading`/`Errored`/`Repeat`/`Reveal` instead of `Index`.
- `createEffect` and `createRenderEffect` are split into `(compute, apply)`: the compute phase tracks, the apply phase polls. The `no-destructure` autofix emits `merge`/`omit`.

Projects still on Solid 1.x can use this release with `"solid/imports": "off"`. That rule is the only active conflict: it reports `import type { JSX } from "solid-js"` and its autofix rewrites the import to `@solidjs/web`, which a Solid 1 project does not have installed. The other rules go quiet on Solid 1 patterns rather than misfiring, and TypeScript already rejects the removed exports (`Suspense`, `Index`, `createResource`, `onMount`, `mergeProps`) with a clearer message than a linter could give.
