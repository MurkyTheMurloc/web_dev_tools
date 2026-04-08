---
name: solidjs
description:
    Build and refactor SolidJS code using current reactive primitives,
    control-flow components, async patterns, and SSR-aware practices. Use when
    working on Solid components, state, resources, Suspense, props, or Solid app
    architecture.
---

# SolidJS

Use this skill when working on SolidJS applications and components.

Read [solid-patterns.md](references/solid-patterns.md) when you need the
concrete framework patterns and current guidance.

Treat this repo's Solid Oxc preset as the source of truth for code style and
framework conventions. The skill should reinforce the same defaults the Solid
plugin enforces instead of drifting into parallel advice.

## Default Approach

- Use Solid's fine-grained reactivity directly.
- Keep components small, focused, and boundary-oriented.
- Prefer framework primitives over React-style habits copied across.
- Preserve SSR and hydration correctness.
- Prefer public behavior and component boundaries in tests.

## Core Rules

- Use `createSignal` for local state.
- Use `createMemo` for derived state when recomputation or reuse matters.
- Use `createResource` with `Suspense` for async data flows.
- Use Solid control flow like `Show`, `For`, and `Switch` instead of generic JS
  patterns when that improves readability and reactivity.
- Use `splitProps` and `mergeProps` when building reusable component interfaces.
- Keep side effects in `createEffect`, and use cleanup deliberately.
- Avoid introducing React mental models like dependency-array hooks or
  unnecessary wrapper abstractions.

## Lint-Derived Defaults

Follow these conventions by default because the Solid Oxc preset enforces them:

- **Always** write components as `export const Foo: Component<Props> = (props) => {}`.
  Never use `export function Foo(...)`. The `prefer-arrow-components` rule flags
  all `export function` component declarations regardless of how props are written —
  named props, destructured props, or no props at all.
- Use `Component<Props>` for components without children.
- Use `ParentComponent<Props>` for components that accept or render
  `props.children`.
- Keep component props as a single `props` object. Do not destructure component
  props in the parameter list — the `no-destructure` rule flags this separately.
- Use `props.foo`, not `{ foo }`, to preserve Solid reactivity.
- Keep conditionals inside JSX. Do not early-return different JSX branches from
  a component.
- Prefer `<For>` over `array.map(...)` when rendering JSX lists.
- Prefer `<Show>` over `condition && <Thing />` or JSX ternaries when the branch
  is substantial enough to read like UI.
- Use `class`, not `className`.
- Use `for`, not `htmlFor`.
- Prefer `classList` over classnames-style helpers when toggling classes from
  booleans.
- Use Solid-style `style` objects with kebab-case CSS keys and string dimension
  values like `{ "font-size": "14px" }`.
- Do not use `innerHTML` unless the HTML is known-safe and static.
- Do not use `javascript:` URLs in JSX.
- Do not pass arrays as event handlers.
- Keep JSX prop names and namespaces Solid-compatible.
- Keep Solid imports coming from the correct package: `solid-js`,
  `solid-js/web`, or `solid-js/store`.
- Avoid dependency arrays in `createEffect` and `createMemo`; use `on(...)` when
  you need explicit dependency control.

## SSR And App Integration

- Respect the Solid JSX setup used in this repo style:
    - `jsx: "preserve"`
    - `jsxImportSource: "solid-js"`
- Prefer SSR-safe code paths.
- Be careful with browser-only APIs during render.
- Treat hydration mismatches as correctness bugs, not cosmetic issues.

## Implementation Workflow

### 1. Pick the right reactive primitive

Choose based on intent:

- local mutable state -> `createSignal`
- derived value -> `createMemo`
- async dependency -> `createResource`
- side effect / subscriptions -> `createEffect`

### 2. Design component boundaries

Before coding, decide:

- what props are local versus forwarded
- what state belongs inside versus outside
- what should be derived instead of stored
- where `splitProps` or `mergeProps` clarifies the interface
- whether the component should be `Component<Props>` or `ParentComponent<Props>`

Write components in the default preferred form:

```tsx
import type { Component, ParentComponent } from "solid-js";

type LeafProps = {
    name: string;
};

export const Leaf: Component<LeafProps> = (props) => {
    return <div>{props.name}</div>;
};

type CardProps = {
    title: string;
};

export const Card: ParentComponent<CardProps> = (props) => {
    return (
        <section>
            <h2>{props.title}</h2>
            {props.children}
        </section>
    );
};
```

Do not reach for these styles — both are flagged by lint rules:

```tsx
// ❌ export function — flagged by prefer-arrow-components
export function Card(props: CardProps): JSX.Element {
    return <section>{props.children}</section>;
}

// ❌ destructured props — flagged by no-destructure (and prefer-arrow-components if function form)
export const Card = ({ title, children }: CardProps) => {
    return <section>{children}</section>;
};
```

Both shapes fight the lint rules and weaken prop reactivity.

### 3. Compose loading and error states

For async work:

- prefer `createResource`
- wrap UI in `Suspense`
- add error handling where failure is meaningful

### 4. Verify rendering behavior

Check:

- conditional UI uses `Show` or related control flow clearly
- lists use `For`
- expensive derived state is memoized only when needed
- no browser-only API leaks into SSR render paths
- no early-return JSX branches in components
- no React-only props like `className` or `htmlFor`
- no unsafe DOM escape hatches like `innerHTML` or `javascript:` URLs

## Reactive Safety Rules

- Signals, props, memos, and other reactive values must be consumed in JSX,
  tracked scopes like `createEffect`, or event-handler functions.
- Do not treat Solid effects like React hooks. `createEffect(fn, deps)` and
  `createMemo(fn, deps)` are the wrong mental model here.
- If you need explicit dependency tracking, use `on(...)`.
- Native DOM event bindings are not a special reactivity escape hatch. Pass
  event handler functions instead of baking reactive reads into the prop value
  itself.
- If this stack enables the proxy-safety rule, avoid patterns that rely on
  Proxy-based APIs such as `solid-js/store`, risky JSX spreads, or `mergeProps`
  function inputs that force proxies.

## DOM And Styling Rules

- Use `classList={{ active: condition, disabled: otherCondition }}` for boolean
  class toggles.
- Keep `style` props object-based and Solid-native:

```tsx
<div
    class="card"
    classList={{ active: props.active }}
    style={{
        "font-size": "14px",
        "margin-top": "0.5rem",
    }}
/>
```

- Do not write React-style style objects like `{ fontSize: 14 }`.
- Self-close empty components and empty elements when possible.
- Keep event prop names explicit and Solid-compatible. If a prop starts with
  `on`, it should genuinely behave like an event handler.
- Do not use array-form event handlers as a shortcut. Prefer a plain callback.

## Testing Guidance

- Test component behavior and rendered outcomes.
- Prefer testing through user-visible states rather than internal signals.
- Cover loading, success, empty, and error states for async components.
- Include realistic edge cases where SSR, hydration, or nullish props could
  break behavior.
- Include Solid-specific edge cases:
    - props that change after initial render
    - conditionals that might tempt an early return
    - list rendering updates
    - components with and without children
    - style and event prop regressions when refactoring from React-like code
