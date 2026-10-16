# Solid

`@shadcn/lint` reads Solid 2.0 JSX under Oxlint and ESLint, with the same
setup as [React](./react.md). Solid 2.0 changes three things the linter
has to know about:

- `classList` is gone. `class` takes a string, an object (keys are
  classes, values are conditions) or an array of both.
- Components receive their classes as `props.class` and do not
  destructure props.
- `mergeProps` and `splitProps` are now `merge` and `omit`.

## What is read

| Markup                                          | Read as                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| `class="p-4"`                                   | a static class string                            |
| `class={{ "bg-primary": active() }}`            | an object, keys as classes, values ignored       |
| `class={["p-4", { "mt-2": open() }, [nested]]}` | an array, nested arrays and objects too          |
| `class={cn("p-4", props.class)}`                | a helper call, the received class accepted       |
| `class={{ [name()]: true }}`                    | unreadable, reported by `require-static-classes` |

An object on `class` is read as clsx reads it in every JSX file, not only
in Solid files: React has no `class` prop an object could mean anything
else on. `className`, `classNames` and other class-like props keep reading
an object as a map of slots to classes, as before.

## Wrappers

A component outside the ui directory that forwards its received class to
a design-system component is a wrapper, so `no-restyle` checks classes
written on it against the component it wraps:

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
className to <Button>, which owns its color.
```

Forwarding is found through `props.class` in `class` (string, `cn()`,
array or object), through a spread of `props`, of `omit(props, ...)`
when `"class"` is not omitted, and of `merge(..., props)` when no later
source sets `class`. A `merge` default for `class` is checked where it
is written.

## Limits

- The `class` prop and `merge`/`omit` are recognized only in a file that
  imports from `solid-js` or `@solidjs/*`. A type import such as
  `import type { ComponentProps } from "@solidjs/web"` is enough. In other
  JSX files `props.class` stays what it was before: an unreadable value.
- `merge` and `omit` are recognized by their import, under any local
  name. Solid 1.x `mergeProps` and `splitProps` are not followed.
- Destructured props (`({ class: cls }) => ...`) are followed like
  React's, though Solid warns about them.
- Messages say `class`, the prop Solid components receive. The
  `{{className}}` placeholder keeps its name.