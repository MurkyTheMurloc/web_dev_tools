---
name: tdd
description:
    Test-driven development with a red-green-refactor loop for Bun and Vitest.
    Use when the user wants to build features or fix bugs test-first, mentions
    TDD or red-green-refactor, or wants integration-style tests focused on
    behavior.
---

# Test-Driven Development

Use this skill when implementing a feature or fixing a bug test-first.

This version is tuned for this toolchain:

- Bun-first execution
- Vitest instead of Jest
- behavior-first tests through public interfaces
- one vertical slice at a time

Read [tests.md](references/tests.md) for good and bad test examples. Read
[mocking.md](references/mocking.md) when deciding whether a dependency should be
mocked.

## Core Principles

- Test behavior, not implementation details.
- Prefer integration-style tests through public interfaces.
- Test not only the obvious passing path, but also realistic edge cases and
  failure modes.
- Do one vertical slice at a time:
    - RED: write one failing test for one behavior
    - GREEN: write the minimal code to pass
    - REFACTOR: improve the design only after green
- Never write a full wall of tests first and implementation second.
- When possible, use the real code path and mock only true system boundaries.

## Workflow

### 1. Frame the behavior

Before writing code:

- identify the public interface that should change or be added
- list the behaviors worth testing
- choose the first tracer-bullet behavior
- prefer critical paths and complex logic first, then add realistic edge cases
  systematically

If the expected behavior is already clear from the task and code, proceed. If it
is not clear, clarify the behavior first.

### 2. Write one failing test

Write exactly one test for one observable behavior.

The test should:

- use the public interface
- describe what the system does
- fail for the right reason
- avoid coupling to internal collaborators

Use Vitest style and Bun-first commands.

### 3. Make it pass with minimal code

Write only enough implementation to turn the test green.

- do not anticipate future tests
- do not add speculative branches or abstractions
- prefer the most direct working code

### 4. Refactor after green

Only refactor when the suite is green.

Look for:

- duplication
- shallow modules that can be deepened
- awkward seams suggesting a better interface
- names and boundaries that the new code revealed

### 5. Expand to realistic edge cases

Once the happy path is green, deliberately probe behaviors that are rare but
still possible.

Good edge-case candidates include:

- boundary values
- empty inputs
- malformed but plausible inputs
- nullish and missing values
- unusual ordering
- repeated operations
- large or degenerate payloads
- error and retry paths
- JavaScript coercion quirks where relevant

Do not turn this into random case generation without a reason. The goal is to
cover cases that are uncommon but still credible in production.

Add these edge-case tests one by one, the same way as the main loop:

- write one failing test
- make it pass minimally
- refactor after green

### 6. Run the quality loop

After each completed slice:

- run the relevant test command
- run any directly affected typecheck or build check when appropriate
- run formatting and lint checks for the touched area

Use fixers when they preserve the intended rule set. Do not disable rules to get
green output.

## Testing Guidance

- Prefer `vitest` terminology and APIs in examples.
- Prefer boundary tests over asserting on call counts or private helper
  behavior.
- Prefer a layered test shape:
    - first prove the primary behavior
    - then expand into rare-but-possible scenarios
- Mock at system boundaries only:
    - third-party APIs
    - clocks/randomness
    - filesystem where needed
    - databases only when a realistic local test substitute is not practical
- Do not mock your own internal modules by default.

## Per-Cycle Checklist

- test describes behavior, not implementation
- test uses the public interface
- test would survive an internal refactor
- code is minimal for the current behavior
- no speculative features were added
- realistic edge cases were considered, not only the obvious passing path
- checks were re-run after the slice
