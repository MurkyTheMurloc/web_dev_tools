# web_dev_tools

Bun workspace with the `@murky-web/*` npm packages. Each package is released through
changesets (`.changeset/`, release PR "chore: version packages", then the Publish
workflow with npm trusted publishing).

## Packages

| Path | Package | What it is |
|---|---|---|
| `packages/typebuddy` | `@murky-web/typebuddy` | runtime guards, `Result`, utility and global types (`globals.d.ts`), and its oxlint plugin (`rules/`, `oxlint/`) |
| `packages/simplelog` | `@murky-web/simplelog` | small logger, and its oxlint plugin (`oxlint/`) |
| `packages/oxlint-plugin-solid` | `@murky-web/oxlint-plugin-solid` | Solid rules for oxlint |
| `packages/shadcn-lint/packages/lint` | `@murky-web/shadcn-lint` | Tailwind design-system rules for Solid 2.0 (fork of shadcn-ui/lint, see `docs/shadcn-lint-fork.md`) |
| `config/` | – | shared oxlint/oxfmt rules (`config/oxc`) and tsconfig bases (`config/typescript`), extended by the packages; not a package |
| `vendor/anti-slop` | – | dmmulroy/anti-slop as a submodule, copied into projects by the templates |

## Tooling

- Bun only: `bun install`, `bun run <script>`, tests with `bun run test` (vitest), never `bun test`.
- TypeScript 7 (`tsc`), builds with `tsdown`.
- Lint and format with oxlint and oxfmt from `config/oxc`. Each package has its own `lint`
  with its own `.oxlintrc.jsonc` extending the shared one; the root `bun run lint` runs every
  package's `lint`. The lint plugins have no `lint` script; their tests are the check.
- `config/`, every `.oxlintrc*`, `.oxfmtrc*` and `tsconfig*` are the user's: never edit them
  to make a check pass. Fix the code.

## Before reporting done

Per changed package: `bun run lint`, `bun run typecheck`, `bun run test` where the package
has them, plus its `release:verify:*` script from the root `package.json`. A change that
ships needs a changeset (`bun run changeset`).

## oxlint-plugin-solid

- One rule per file in `src/rules/`, exported as `export const myRuleRule = { meta, create }`,
  registered in `src/index.mjs`.
- Tests: add the id to `expectedRuleIds` and a case to `ruleCases` in `tests/rule_cases.mjs`
  (fix cases in `preferArrowFixCases` or a new array). The harness runs real oxlint.
- `prefer-arrow-components` turns `export function Component` into
  `export const Component: Component<Props> = (props) => …`; `no-destructure` flags
  destructured props.

## Lint plugins in general

The lint plugins (`typebuddy/rules`, `simplelog/oxlint`, `oxlint-plugin-solid`,
`shadcn-lint`) walk an untyped AST and are not held to the strict shared config. Their
tests are the check.
