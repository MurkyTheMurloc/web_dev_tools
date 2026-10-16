# Adding linting to an existing project

Start with one rule. Fix the common violations, then add more checks.
You can set each rule's severity and choose which files it checks.

Use the [README setup](../README.md#install) first. The examples below are
`.oxlintrc.jsonc` snippets.

## Start with warnings

Set `no-restyle` to `warn` in the main `rules` object:

```jsonc
"shadcn/no-restyle": ["warn", { "allow": ["layout"] }]
```

This keeps layout classes allowed, as in the README. Keep the
component-directory override, then run:

```bash
bunx oxlint
```

Look for repeated errors, such as padding on buttons. Fix those patterns
before working through individual files.

## Limit the warning count

Use the measured count in your lint script. For example, if the project
has 287 warnings:

```json
{
  "scripts": {
    "lint": "oxlint --max-warnings 287"
  }
}
```

Run this script in CI. It fails when the total increases. Lower the cap
as you fix findings.

## Keep new code strict

You can enforce a rule in new code while leaving legacy code at `warn`.
Add these objects to `overrides`, before the component-directory override:

```jsonc
{
  "files": ["app/**", "features/**"],
  "rules": { "shadcn/no-restyle": ["error", { "allow": ["layout"] }] }
},
{
  "files": ["legacy/**"],
  "rules": { "shadcn/no-restyle": ["warn", { "allow": ["layout"] }] }
}
```

To exempt a folder, turn off the specific rule there. Other lint checks
still run:

```jsonc
{ "files": ["marketing/**"], "rules": { "shadcn/no-restyle": "off" } }
```

## Fix findings

- Use an existing variant for a component's appearance.
- Use a contract when callers should control part of its styling.
- Use suggested tokens or scale values when they match the design.
- Review new tokens and variants before adding them.

For example, a title can allow typography through a contract:

```jsonc
"shadcn/no-restyle": ["warn", {
  "allow": ["layout"],
  "contracts": [
    { "pattern": "^CardTitle$", "allow": ["layout", "typography"] }
  ]
}]
```

```tsx
<CardTitle class="text-sm">Account settings</CardTitle>
```

A contract overrides the keys it writes and inherits the rest, so a
contract that writes `allow` restates `layout` when the component
should keep it. See
[Configuring your design system](./design-systems.md) for help choosing variants and contracts.

## Add more rules

When a rule is clean, change it to `error`. Add other rules at `warn`
first, then promote each one as you resolve its findings. A configuration
with all five core rules enabled looks like this:

```jsonc
"rules": {
  "shadcn/no-restyle": ["error", { "allow": ["layout"] }],
  "shadcn/no-raw-colors": "error",
  "shadcn/no-arbitrary-values": ["error", { "allow": ["layout"] }],
  "shadcn/no-inline-styles": "error",
  "shadcn/require-static-classes": "error"
}
```

Update the component-directory override too. Components own their
appearance and may need structural values such as `ring-[3px]`:

```jsonc
{
  "files": ["components/ui/**"],
  "rules": {
    "shadcn/no-restyle": "off",
    "shadcn/no-arbitrary-values": "off",
    "shadcn/require-static-classes": "off"
  }
}
```

Adjust the path to your component directory. `no-raw-colors` and
`no-inline-styles` stay enabled inside it.

Add [`no-unknown-classes`](./rules/no-unknown-classes.md) separately, at
`warn` first. Classes supplied by other stylesheets may need an `allow`
entry. Remove `--max-warnings` once all enabled rules are errors.

## Agents

Add your lint command to `package.json`, then put this in `AGENTS.md`:

```md
After making changes, run `bun run lint` and fix all errors.
```

Review new tokens, variants, and exceptions in the resulting changes.

## Exceptions

Document an intentional exception next to the code:

```tsx
// oxlint-disable-next-line shadcn/no-raw-colors -- Partner brand color, approved by design.
<span class="bg-amber-400">Sponsor</span>
```

`rg "oxlint-disable.*shadcn/"` finds these comments.
