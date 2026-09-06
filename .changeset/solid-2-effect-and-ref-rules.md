---
"@murky-web/oxlint-plugin-solid": minor
---

Add two rules for Solid 2.0's split effects and unowned ref callbacks, and
repair two existing ones.

`solid/no-untracked-effect-read` reports a reactive read in the apply phase of a
two-argument `createEffect`. That phase runs untracked, so
`createEffect(() => roomId(), (id) => connect(id, theme()))` never re-runs when
`theme` changes. Nothing reported this: `reactivity` marks the apply phase as a
tracked scope, and its model has no state for "matches, but does not subscribe".

`solid/no-owned-primitives-in-ref` reports `createEffect`, `onCleanup` and
related primitives inside a ref callback. Solid 2.0 ref callbacks are unowned —
`getOwner()` returns null — so the effect is never disposed and the cleanup
never runs. Directive factories, which create these primitives while they still
have an owner, are unaffected.

`solid/no-setter-in-effect` now also reports an async apply phase that awaits and
writes the result back into a signal. Its existing check requires every
statement to be a setter call, which an `await` breaks.

`solid/prefer-class-object` matched only the lowercase `classlist`. JSX prop
names are case-sensitive and the Solid 1 prop is `classList`, so the migration
rule missed every real call site.

`solid/imports` now knows `createLoadingBoundary`, `createErrorBoundary` and
`createRevealOrder`, so importing one from the wrong module is reported like
every neighbouring primitive.

`solid/jsx-no-duplicate-props` recommended `classList`, which Solid 2.0 removed
and the neighbouring rule reports. It now points at the object and array forms
of `class`.
