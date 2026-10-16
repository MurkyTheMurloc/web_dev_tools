# Solid

`@murky-web/shadcn-lint` reads Solid 2.0 JSX under Oxlint; setup is in the
[README](../README.md#install). Solid 2.0 changes three things the linter knows about:

- `classList` is gone. `class` takes a string, an object (keys are classes, values are
  conditions) or an array, or both.
- Components receive classes in `props.class` and do not destructure props.
- `mergeProps` and `splitProps` are now `merge` and `omit`.

## What is read

| Markup | Read as |
| ----------------------------------------------- | ------------------------------------------------ |
| `class="p-4"` | a static class string |
| `class={{ "bg-primary": active() }}` | an object, keys are classes, values are ignored |
| `class={["p-4", { "mt-2": open() }, [nested]]}` | an array, nested arrays and objects too |
| `class={cn("p-4", props.class)}` | a helper call, the received class is accepted |
| `class={{ [name()]: true }}` | unreadable, reported by `require-static-classes` |

An object on `class` is read the way clsx reads it: keys are classes. Other class-like
props (`containerClass`, `classes`) read an object as a map of slots to classes, by its
values.

## Wrappers

A component outside the ui directory that forwards its received class to a design-system
component is a wrapper, so `no-restyle` checks classes written on it against the
component it wraps:

```tsx
import type { ComponentProps } from "@solidjs/web"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { omit } from "solid-js"

export const SaveButton = (props: ComponentProps<typeof Button>) => {
  const rest = omit(props, "class")
  return <Button class={cn("w-full", props.class)} {...rest} />
}
```

```text
"bg-primary" is not allowed on <SaveButton>: <SaveButton> forwards
class to <Button>, which owns its color.
```

Forwarding is found through `props.class` in `class` (string, `cn()`, array or object),
through a spread of `props`, through `omit(props, ...)` when `"class"` is not omitted,
and through `merge(..., props)` when no later source sets `class`. A `merge` default for
`class` is checked where it is written.

## Limits

- `merge` and `omit` are recognized by import from `solid-js` or `@solidjs/*`, under any
  local name. Solid 1.x `mergeProps` and `splitProps` are not followed.
- Destructured props (`({ class: cls }) => ...`) are followed too, though Solid warns
  about them. A props object handed to another function keeps the forwarding: Solid's
  props are read-only.
- Messages say `class`, the prop Solid components receive. The placeholder for the
  offending class in custom messages is `{{class}}`.
