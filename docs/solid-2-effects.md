# Effects in Solid 2.0

A short guide for people and coding agents, built from the official Solid docs:

- [createEffect](https://docs.solidjs.com/reference/solid-js/reactivity/create-effect)
  (reference)
- "Avoid unnecessary effects" (guide)
- "Common problems" (createEffect and reactivity pages)
- the diagnostics reference, one page per code (linked in the table below)

The lint rules in `@murky-web/oxlint-plugin-solid` link here.

## The two phases

```ts
createEffect(
    () => ({ amount: subtotal(), currency: currency() }), // compute: tracked
    ({ amount, currency }) => {
        // effect: untracked
        const widget = payments.mount(element, { amount, currency });
        return () => widget.unmount(); // cleanup: before the next run, on disposal
    }
);
```

| Phase                  | Runs                                       | Put here                                                       | Never here                                                                    |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| compute (1st argument) | reactively, whenever what it reads changes | every reactive read; return the values the effect needs        | side effects, setter calls                                                    |
| effect (2nd argument)  | untracked, after the queue flushes         | DOM writes, fetch, logging, subscriptions, third-party widgets | reactive reads (they do not subscribe), `onCleanup`, writes to reactive state |

- The effect function receives what compute returned (`(next, prev)`) and may
  return a cleanup function.
- `{ effect, error }` (an effect bundle) in place of the effect function also
  catches compute-phase errors.
- On the server, effects do not run.
- A single-phase tracked effect is `createTrackedEffect`, with its tradeoffs.

## Check before adding an effect

1. Can the value be calculated directly in JSX or a derived function?
2. Does the result need a memo for reuse or an equality boundary?
3. Is it asynchronous data that belongs in an async memo or a store created from
   a function?
4. Is it a temporary local override that belongs in a writable derived signal or
   store?
5. Did a user interaction cause the work? Keep it in the event handler or an
   action.
6. Is the work one-time owned setup? Use `onSettled` or a ref directive.
7. Does a settled reactive result need to leave Solid and drive an imperative
   system? Use an effect.

An effect belongs at the end of the graph: a settled result leaves Solid and
drives something Solid does not own.

## Canonical patterns

**Derive.** A value computed from other values is a function, or a memo when
several readers share it, it is expensive, or its equality check should stop a
chain.

```ts
const subtotal = () => cart.items.reduce((sum, item) => sum + item.price, 0);
const total = createMemo(() => subtotal() * (1 + taxRate()));
```

**Async memo.** Async data is a derivation, read inside `<Loading>` /
`<Errored>`. Solid drops the answer of a superseded run. For a list whose items
keep identity, use `createStore(async () => …, seed)`.

```ts
const results = createMemo(async () => {
    const text = query().trim();
    if (!text) return [];
    return api.search(text);
});
```

**Writable derivation.** A local editable copy that resets when its source
changes:

```ts
const [draft, setDraft] = createSignal(() => props.value);
const [address, setAddress] = createStore(() => props.address, seed);
```

**Action in the handler.** Work caused by an interaction runs where the
interaction happens, not in an effect that watches a flag:

```tsx
const save = action(function* () {
    yield api.saveAddress(snapshot(draft));
});
<button
    type="button"
    onClick={() => void save()}
>
    Save
</button>;
```

**Imperative boundary with cleanup.** Read every input in compute, hand the
values across, return the cleanup (see the example at the top). If compute
reaches pending async work, the effect function waits for it to settle.

**`onSettled` observer.** One-time setup after the render has settled. A
callback that reports a browser observation may write a signal. The returned
cleanup runs when the owner is disposed.

```ts
onSettled(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
        setWidth(entry.contentRect.width)
    );
    observer.observe(element);
    return () => observer.disconnect();
});
```

## Diagnostic codes

| Code                                                                                                             | What happened                                                                                | Fix                                                                                                                                                                                                                                             | Lint rule                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [MISSING_EFFECT_FN](https://docs.solidjs.com/reference/solid-js/diagnostics/missing-effect-fn)                   | `createEffect` got one function (or a dependency array in place of the effect function).     | Split it: compute reads, effect acts, `createEffect(() => source(), (value) => doWork(value))`. A function that only computes a value is `createMemo`. One-time setup is `onSettled`.                                                           | `solid/no-single-arg-create-effect`, `solid/no-react-deps`                   |
| [EFFECT_RELAY_TEAR](https://docs.solidjs.com/reference/solid-js/diagnostics/effect-relay-tear)                   | An effect copies a value into another signal; the copy paints one flush late.                | Delete the signal and the effect and derive the value (function or `createMemo`). Local editable copy: `createSignal(() => props.value)` / `createStore(() => props.x, seed)`. Async data: async `createMemo` inside `<Loading>` / `<Errored>`. | `solid/no-setter-in-effect`                                                  |
| [EFFECT_WRITES_OWN_SOURCE](https://docs.solidjs.com/reference/solid-js/diagnostics/effect-writes-own-source)     | The effect function writes a signal or store its compute reads, so it runs twice per change. | Put the written value in a memo, or normalize where the source is written (handler, action).                                                                                                                                                    | `solid/no-setter-in-effect`                                                  |
| [STRICT_READ_UNTRACKED](https://docs.solidjs.com/reference/solid-js/diagnostics/strict-read-untracked)           | A reactive value was read outside a tracking scope (component body, destructured props).     | Read it in JSX, a memo, or an effect's compute function. A read in the effect function does not subscribe either: move it into compute.                                                                                                         | `solid/reactivity`, `solid/no-destructure`, `solid/no-untracked-effect-read` |
| [NO_OWNER_CLEANUP](https://docs.solidjs.com/reference/solid-js/diagnostics/no-owner-cleanup)                     | `onCleanup` ran without an owner (for example in an effect function); it never runs.         | Return the cleanup from the effect function: `return () => …`.                                                                                                                                                                                  | `solid/no-cleanup-in-effect-apply`                                           |
| [CLEANUP_IN_FORBIDDEN_SCOPE](https://docs.solidjs.com/reference/solid-js/diagnostics/cleanup-in-forbidden-scope) | `onCleanup` inside `onSettled`, `createTrackedEffect` or a ref callback; Solid throws.       | Return the cleanup from the callback. For a ref, register it in the factory that returns the ref callback.                                                                                                                                      | `solid/no-cleanup-in-effect-apply`, `solid/no-owned-primitives-in-ref`       |
| SERVER_WRITE                                                                                                     | A setter ran during a server render; it does nothing there.                                  | Make the source itself the value: `createSignal(() => source)` or `createStore(async () => …, seed)`. Optimistic state is client-only.                                                                                                          | none (runtime only)                                                          |

Turn on `solid-js/attribution` (`attribution.enable()`, `why(node)`, `costs()`)
to see the perf diagnostics (relay tears, own-source writes) in dev.

## Lint rules

| Rule                                 | Reports                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `solid/no-single-arg-create-effect`  | `createEffect(fn)` / `createRenderEffect(fn)` with one function.                                                                                                   |
| `solid/no-react-deps`                | A React dependency array in `createEffect`, `createRenderEffect` or `createMemo`. Suggests the two-phase split or `onSettled` for `[]`; never autofixes an effect. |
| `solid/no-untracked-effect-read`     | A signal or props read in the effect function.                                                                                                                     |
| `solid/no-setter-in-effect`          | An effect that only relays a value into a signal or store, awaits and writes, or writes its own source.                                                            |
| `solid/no-cleanup-in-effect-apply`   | `onCleanup` in an effect function, `onSettled` or `createTrackedEffect` callback.                                                                                  |
| `solid/no-owned-primitives-in-ref`   | `onCleanup`, `createEffect` and other owned primitives in a ref callback.                                                                                          |
| `solid/no-write-in-pure-computation` | A setter in a memo or in the compute function.                                                                                                                     |

## For agents: watch out for

- Do not only delete a dependency array from `createEffect`: a one-argument
  effect throws MISSING_EFFECT_FN. Split it into compute and effect.
- Do not read signals or props in the effect function. Read them in compute and
  take the values as parameters.
- Do not call `onCleanup` in an effect function, `onSettled` or
  `createTrackedEffect`. Return the cleanup.
- Do not wrap a read in `untrack()` to make a lint error go away; the value then
  never updates.
- Do not copy a value into a signal from an effect. Derive it, or use a writable
  derivation for a local editable copy.
- Do not add a loading flag or run counter to an effect that awaits. Use an
  async memo; Solid handles loading and superseded runs.
- Do not move a relay write into `onSettled` or `queueMicrotask`; that keeps the
  copy.
- Do not disable a rule with `// oxlint-disable`. Each message names the fix.
