# shadcn-lint fork

`vendor/shadcn-lint` is [shadcn-ui/lint](https://github.com/shadcn-ui/lint) (MIT) as a git
subtree, published as `@murky-web/shadcn-lint` with Solid 2.0 support. We do not send changes
back, but we follow upstream: their fixes and new rules come in through the subtree.

## Pull upstream

```sh
bun run shadcn-lint:upstream
```

That is `git subtree pull --prefix vendor/shadcn-lint https://github.com/shadcn-ui/lint main --squash`.
Then run `bun run release:verify:shadcn-lint` and add a changeset for `@murky-web/shadcn-lint`.

## Keep the fork easy to update

Change as few upstream files as possible; add new files instead. Every changed upstream file can
conflict on the next pull. Our changes:

| File | Change |
|---|---|
| `packages/lint/package.json` | name, description, repository, homepage, bugs, publishConfig, keywords, devDependencies (prettier, sort-imports plugin) |
| `packages/lint/scripts/prepack.mjs` | README links point at this repo |
| `packages/evals/package.json`, `packages/evals/lib/{lint,classify}.mjs` | the new package name |
| `README.md` | fork note at the top |
| Solid 2.0 support (SID-384) | `src/` and `test/` changes for `class` objects, `props.class`, `merge`, `omit`; `docs/solid.md` |
| `packages/lint/package-lock.json` | **new file, ours.** Upstream keeps `pnpm-lock.yaml` and `packageManager: pnpm` in `vendor/shadcn-lint`; changesets detects the package manager from the nearest lock file and would call `pnpm publish`, which CI does not have. This near-empty npm lock file makes it pick npm, without touching upstream files. Do not delete it. |
