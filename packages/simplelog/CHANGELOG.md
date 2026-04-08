# @murky-web/simplelog

## 1.0.1

### Patch Changes

- 7e352f1: Fix structured logger argument serialization so functions nested inside objects and arrays are preserved as readable labels like `[Function namedHelper]` instead of being dropped by JSON serialization.

This file exists so `changesets/action` can open a package changelog when it
creates the release PR branch.
