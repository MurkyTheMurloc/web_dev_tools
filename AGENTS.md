# web_dev_tools

Bun workspace with the `@murky-web/*` npm packages. Each package is released through
changesets (`.changeset/`, release PR "chore: version packages", then the Publish
workflow with npm trusted publishing).

## Packages

| Path | Package | What it is |
|---|---|---|
| `packages/typebuddy` | `@murky-web/typebuddy` | runtime guards, `Result`, utility and global types (`globals.d.ts`), and its oxlint plugin (`rules/`, `oxlint/`) |
| `packages/simplelog` | `@murky-web/simplelog` | small logger, and its oxlint plugin (`oxlint/`) |
| `packages/oxlint-plugin` | `@murky-web/oxlint-plugin` | base oxlint plugin (`murky/*`): generic JavaScript rules and shared helpers (`./utils`); `-solid` and `-typescript` specialise it |
| `packages/oxlint-plugin-solid` | `@murky-web/oxlint-plugin-solid` | Solid rules for oxlint |
| `packages/oxc-config` | `@murky-web/oxc-config` | shared oxfmt and oxlint rules, extended by the packages here and by consuming projects |
| `packages/shadcn-lint/packages/lint` | `@murky-web/shadcn-lint` | Tailwind design-system rules for Solid 2.0 (fork of shadcn-ui/lint, see `docs/shadcn-lint-fork.md`) |
| `config/` | – | tsconfig bases (`config/typescript`), extended by the packages; not a package |
| `vendor/anti-slop` | – | dmmulroy/anti-slop as a submodule, copied into projects by the templates |

## Tooling

- Dev environment: devenv (`devenv.nix`; direnv loads it via `.envrc`). It provides Bun and
  Node 24 and runs `bun install` when `bun.lock` changed; without direnv use
  `devenv shell -- <cmd>`. `packageManager` in package.json must name the Bun version of the
  shell, CI installs that version.
- Bun only: `bun install`, `bun run <script>`, tests with `bun run test` (vitest), never `bun test`.
- TypeScript 7 (`tsc`), builds with `tsdown`.
- Lint and format with oxlint and oxfmt from `packages/oxc-config`. Each package has its own `lint`
  with its own `.oxlintrc.jsonc` extending the shared one; the root `bun run lint` runs every
  package's `lint`. The lint plugins have no `lint` script; their tests are the check.
- `config/`, `packages/oxc-config/`, every `.oxlintrc*`, `.oxfmtrc*` and `tsconfig*` are the user's: never edit them
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

The lint plugins (`typebuddy/rules`, `simplelog/oxlint`, `oxlint-plugin`, `oxlint-plugin-solid`,
`shadcn-lint`) walk an untyped AST and are not held to the strict shared config. Their
tests are the check.
