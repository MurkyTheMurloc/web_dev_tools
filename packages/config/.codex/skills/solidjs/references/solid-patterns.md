# SolidJS Patterns

This reference intentionally mirrors the Solid Oxc preset used in this repo.
Treat it as the practical pattern guide behind the lint rules, not as a separate
style system.

## Component Shape

Prefer typed arrow components:

```tsx
import type { Component, ParentComponent } from "solid-js";

type ButtonProps = {
    label: string;
};

export const Button: Component<ButtonProps> = (props) => {
    return <button>{props.label}</button>;
};

type PanelProps = {
    title: string;
};

export const Panel: ParentComponent<PanelProps> = (props) => {
    return (
        <section>
            <h2>{props.title}</h2>
            {props.children}
        </section>
    );
};
```

Avoid `export function` component declarations entirely — the `prefer-arrow-components`
lint rule flags all of these forms:

```tsx
// ❌ named props
export function Leaf(props: Props): JSX.Element { ... }

// ❌ destructured props
export function Card({ title }: Props): JSX.Element { ... }

// ❌ no props
export function Icon(): JSX.Element { ... }
```

The autofix rewrites all three to the correct arrow form.

## State And Reactivity

- Use `createSignal` for local mutable state.
- Use `createMemo` for derived state when the value is reused or expensive to
  compute.
- Use `createEffect` for reactive side effects.
- Use `onCleanup` to tear down subscriptions, intervals, or listeners.
- Use `on(...)` when you want explicit dependency tracking instead of implicit
  tracking.
- Do not pass React-style dependency arrays to `createEffect` or `createMemo`.

## Props

- Keep component props as `props`.
- Do not destructure component props in the parameter list.
- Read reactive values through property access like `props.value`.
- Use `splitProps` to separate local component props from forwarded DOM props.
- Use `mergeProps` for layered defaults when that does not force proxy-dependent
  behavior in this stack.

Good:

```tsx
type Props = {
    label: string;
    active?: boolean;
};

export const Tab: Component<Props> = (props) => {
    return <button classList={{ active: props.active }}>{props.label}</button>;
};
```

Avoid:

```tsx
export const Tab = ({ label, active }: Props) => {
    return <button classList={{ active }}>{label}</button>;
};
```

## Async Data

- Use `createResource` for async data.
- Wrap resource consumers in `Suspense`.
- Handle loading, refreshing, and error states explicitly.
- Prefer `initialValue` when the consumer should never see `undefined`.

## Rendering

- Use `Show` for conditional rendering.
- Use `For` for lists.
- Use `Show` keyed mode when you explicitly want subtree recreation on identity
  change.
- Keep conditionals inside JSX instead of returning different branches early
  from the component body.
- Prefer `<For each={items()}>{...}</For>` over `{items().map(...)}` for list
  rendering.

## DOM And Styling

- Use `class`, not `className`.
- Use `for`, not `htmlFor`.
- Prefer `classList` for boolean class toggles.
- Prefer plain callback event handlers over array-form handler shortcuts.
- Keep `style` props as Solid-native objects with kebab-case CSS properties.
- Use string values for dimensional CSS properties like width, margin, padding,
  and font-size.
- Self-close empty elements and components when possible.

Good:

```tsx
<label for={props.id} class="field-label" />

<div
    class="card"
    classList={{ active: props.active }}
    style={{
        "font-size": "14px",
        "margin-top": "0.5rem",
    }}
/>
```

Avoid:

```tsx
<label htmlFor={props.id} className="field-label" />

<div style={{ fontSize: 14, marginTop: 8 }} />
```

## Security And SSR

- Avoid `innerHTML` unless the content is known-safe and static.
- Never use `javascript:` URLs in JSX.
- Avoid browser-only APIs during server render.
- Treat hydration mismatches as correctness issues.
- Structure components so server and client renders agree on initial output.

## Imports

- Import primitives from the correct Solid package:
    - `solid-js` for most reactivity primitives and types
    - `solid-js/web` for web rendering APIs
    - `solid-js/store` only when the target stack explicitly allows those
      proxy-based APIs
- If you use `Show`, `For`, `Switch`, `Suspense`, or similar primitives, keep
  the imports explicit and correct.

## Testing-Oriented Guidance

- Test public behavior, not signals directly.
- For async components, cover:
    - loading
    - success
    - empty
    - error
- Include nullish, boundary, and SSR-sensitive edge cases where relevant.
- Include Solid-specific regression checks for:
    - prop reactivity surviving refactors
    - conditional UI inside JSX instead of early returns
    - `For`-driven list updates
    - children-aware vs non-children component signatures
