# shadcn-lint

`packages/shadcn-lint` started as [shadcn-ui/lint](https://github.com/shadcn-ui/lint) (MIT). It is
now our own package, published as `@murky-web/shadcn-lint`, and reads Solid 2.0 JSX only. We no
longer track upstream: there is no subtree and no upstream pull. React, Vue and Svelte support
and the upstream eval harness are removed.

## Layout

- `packages/shadcn-lint/packages/lint`: the published package (rules, class grammar, project
  analysis, tests).
- `packages/shadcn-lint/docs`: user docs.

Upstream's pnpm workspace files and `packageManager` field are gone; the repo root is a bun
workspace and changesets detects bun.

## Checks

```sh
bun run release:verify:shadcn-lint
```

Builds, typechecks and tests the package. Add a changeset for `@murky-web/shadcn-lint` for every
user-visible change.
