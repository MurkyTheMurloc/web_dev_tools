---
"@murky-web/oxlint-plugin-solid": minor
---

Solid 2.0.2 stable API. `solid/imports` knows `createDeferred`, `createTrackedEffect`, `from`, `onFlush`, `repeat` and `createOwner` (all `solid-js`). `solid/reactivity` treats `createDeferred` like an async memo (its callback is tracked and may return a promise, its result is an accessor), `until(fn)` as a tracked predicate and `onFlush` like `onSettled` (an untracked callback). `solid/reactive-async` checks `createDeferred` callbacks and accessors.
