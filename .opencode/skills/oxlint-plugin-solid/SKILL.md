---
name: oxlint-plugin-solid
description: Use when working in packages/oxlint-plugin-solid — adding rules, fixing rule logic, writing tests, or updating the solid linting config. Also use when a Solid lint rule is not triggering as expected.
---

# oxlint-plugin-solid

Use this skill for work inside `packages/oxlint-plugin-solid` or when debugging why a Solid lint rule is not firing.

## Package location

`packages/oxlint-plugin-solid/`

## Structure

```
src/
  index.mjs              — plugin entry, exports all rules
  rules/                 — one file per rule
  utils.mjs              — shared AST helpers
  compat.mjs             — ESLint v8 compat shim
tests/
  solid_rules.test.mjs   — main test suite (bun:test)
  rule_cases.mjs         — test cases: ruleCases, preferArrowFixCases, preferArrowDiagnosticCases
  helpers.mjs            — lint harness
```

## Running tests

```bash
bun test packages/oxlint-plugin-solid/tests/solid_rules.test.mjs
```

All tests must pass before committing. The harness runs real oxlint with the plugin loaded via Node.

## Rule authoring conventions

- One rule per file in `src/rules/`.
- Export the rule as a named const: `export const myRuleNameRule = { meta, create }`.
- Register it in `src/index.mjs`.
- Add it to `expectedRuleIds` in `tests/rule_cases.mjs`.
- Add a diagnostic test case to `ruleCases` in `tests/rule_cases.mjs`.
- Add fix test cases to `preferArrowFixCases` (or a new array) when the rule is fixable.
- Enable the rule in `packages/config/oxc/linting/solid.jsonc`.

## prefer-arrow-components rule

This is the most important rule in the plugin. It enforces the canonical Solid component shape.

### What it flags

Every `export function` component declaration, regardless of how props are written:

```tsx
// ❌ named props
export function Leaf(props: Props): JSX.Element { ... }

// ❌ destructured props
export function Card({ title }: Props): JSX.Element { ... }

// ❌ no props
export function Icon(): JSX.Element { ... }
```

### What it produces (autofix)

```tsx
// ✅ named props → Component<Props>
export const Leaf: Component<Props> = (props) => { ... }

// ✅ destructured props → Component<Props> (destructure preserved, no-destructure catches it separately)
export const Card: Component<Props> = ({ title }: Props) => { ... }

// ✅ no props → Component
export const Icon: Component = () => { ... }

// ✅ uses props.children → ParentComponent<Props>
export const Panel: ParentComponent<Props> = (props) => { ... }
```

### Detection logic

- Only fires on `FunctionDeclaration` (not arrow functions — those are already correct)
- Requires `ExportNamedDeclaration` parent
- Requires PascalCase name
- Requires at least one JSX return in the body
- Supports: `Identifier` params, `ObjectPattern` params, no params
- Does NOT fire on: async functions, generators, functions with TypeParameters (generics)

## no-destructure rule

Separate from `prefer-arrow-components`. Flags destructured props in arrow components:

```tsx
// ❌ flagged by no-destructure
export const Tab = ({ label }: Props) => { ... }

// ✅ correct
export const Tab: Component<Props> = (props) => { ... }
```

Both rules work together: `prefer-arrow-components` catches `export function`, `no-destructure` catches destructuring in arrow components.

## Adding a new rule

1. Create `src/rules/my_rule.mjs` with `export const myRuleRule = { meta, create }`
2. Import and register in `src/index.mjs`
3. Add `"my-rule"` to `expectedRuleIds` in `tests/rule_cases.mjs`
4. Add a `{ code, ruleId: "my-rule" }` entry to `ruleCases`
5. Add `"solid/my-rule": "error"` to `packages/config/oxc/linting/solid.jsonc`
6. Run tests — all must pass
