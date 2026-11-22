---
"@murky-web/oxlint-plugin-solid": minor
"@murky-web/oxc-config": patch
---

Effect rules built from the Solid 2.0 effect docs, documented in
`docs/solid-2-effects.md`, which the effect rules now link to.

- New rule `solid/no-cleanup-in-effect-apply`: `onCleanup` in an effect function
  (NO_OWNER_CLEANUP, the cleanup never runs) or in an `onSettled` /
  `createTrackedEffect` callback (CLEANUP_IN_FORBIDDEN_SCOPE). Suggests
  `return fn` in place of a trailing `onCleanup(fn)`. On in `oxc-config`.
- `solid/no-react-deps` no longer autofixes an effect into `createEffect(fn, )`,
  which threw MISSING_EFFECT_FN. It also covers `createRenderEffect` and arrays
  in the third argument, suggests the two-phase split
  `createEffect(() => ({ a: a() }), ({ a }) => { … })` and `onSettled` for `[]`,
  and autofixes a memo only when its function reads every dependency.
- `solid/no-setter-in-effect` also reports an effect function that writes a
  signal or store its compute function reads (EFFECT_WRITES_OWN_SOURCE), and its
  relay messages name the docs' fixes: a plain function or `createMemo`, a
  writable derivation, or an async memo under `<Loading>`.
