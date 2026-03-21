---
name: coding-quality
description:
    Build and refactor code so it stays maintainable, extensible, and idiomatic
    for the language and framework in use. Use during implementation,
    refactoring, and code review to keep generated code readable, cohesive,
    testable, and easy to evolve instead of merely "working".
---

# Coding Quality

Use this skill whenever you are writing or restructuring code, not only when
explicitly asked for a review.

The goal is to leave code in a state that:

- solves the task
- is understandable without reverse-engineering
- creates clear seams for future change
- follows language and framework best practices already used by the project

## Quality Standard

Before implementing, think through:

1. What should stay simple and direct?
2. What is likely to change next?
3. Where should the extension seam live?
4. Which abstractions would clarify the design, and which would only add noise?

Do not optimize only for "passes now". Optimize for:

- local readability
- good naming
- low surprise
- cohesive modules
- explicit data flow
- testability
- easy follow-up changes

## Implementation Rules

- Prefer clear, composable units over long mixed-responsibility functions.
- Keep responsibilities narrow and obvious.
- Match the idioms of the language, framework, and repository.
- Reuse existing patterns when they are good; improve them when they are weak.
- Add abstractions only when they reduce duplication or clarify intent.
- Avoid cleverness that hides control flow or data shape.
- Make error paths and boundary behavior explicit.
- Preserve stable public APIs unless the task requires a change.

## Maintainability Checks

During implementation, actively check:

- names reveal intent
- function signatures are small and honest
- modules have one clear reason to change
- dependencies point inward rather than tangling sideways
- state transitions are understandable
- comments explain why, not what
- edge cases are handled where they naturally belong

Read [quality-checklist.md](references/quality-checklist.md) when you need a
quick review pass before finishing.

## Best-Practice Bias

Apply best practices at two levels:

- language best practices
- project-local best practices

That means:

- use the idiomatic constructs of the language instead of fighting it
- follow the repository's established conventions for structure, naming,
  validation, async flow, and testing
- avoid introducing patterns that feel imported from another ecosystem unless
  the project already uses them

## Before Finishing

Before calling the work done:

1. Remove avoidable duplication.
2. Tighten names and boundaries.
3. Check whether a future feature would require touching too many places.
4. Run the relevant formatter, linter, and verification steps.

If a tradeoff remains, call it out explicitly instead of leaving accidental
complexity behind.
