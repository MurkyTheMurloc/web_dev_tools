---
name: improve-codebase-architecture
description:
    Explore a codebase to find opportunities for architectural improvement,
    focusing on making the codebase more testable by deepening shallow modules.
    Use when the user wants to improve architecture, find refactoring
    opportunities, consolidate tightly-coupled modules, or make a codebase more
    AI-navigable.
---

# Improve Codebase Architecture

Explore a codebase like an AI would, surface architectural friction, discover
opportunities for improving testability, and propose module-deepening refactors.

A deep module has a small interface hiding a large implementation. Deep modules
are more testable, more AI-navigable, and let you test at the boundary instead
of inside.

Read [architecture-reference.md](references/architecture-reference.md) when you
need the dependency categories or the issue template.

## Process

### 1. Explore the codebase

Explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small
  files?
- Where are modules so shallow that the interface is nearly as complex as the
  implementation?
- Where have pure functions been extracted just for testability, but the real
  bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk in the seams between
  them?
- Which parts of the codebase are untested, or hard to test?

The friction you encounter is the signal.

### 2. Present candidates

Present a numbered list of deepening opportunities. For each candidate, show:

- Cluster: which modules or concepts are involved
- Why they're coupled: shared types, call patterns, co-ownership of a concept
- Dependency category: use the categories from
  `references/architecture-reference.md`
- Test impact: what existing tests would be replaced by boundary tests

Do not propose interfaces yet. Ask the user which candidate they want to
explore.

### 3. Frame the problem space

For the chosen candidate, explain:

- the constraints any new interface would need to satisfy
- the dependencies it would need to rely on
- a rough illustrative code sketch to make the constraints concrete

This sketch is not a final proposal. It exists to ground the constraints.

### 4. Design multiple interfaces

Produce at least three meaningfully different interface designs. If parallel
agents are explicitly requested and available, you may split them across
sub-agents. Otherwise, do this comparison locally.

Use these design constraints:

- Design 1: minimize the interface and aim for 1-3 entry points
- Design 2: maximize flexibility and extension points
- Design 3: optimize for the most common caller and make the default case
  trivial
- Optional Design 4: ports and adapters for cross-boundary dependencies

For each design, provide:

1. Interface signature
2. Usage example
3. What complexity it hides internally
4. Dependency strategy
5. Trade-offs

Then compare them in prose and give a clear recommendation. If a hybrid is
stronger, propose it explicitly.

### 5. Create a refactor RFC

When the user wants the chosen design captured, create a refactor RFC using the
template in `references/architecture-reference.md`.
