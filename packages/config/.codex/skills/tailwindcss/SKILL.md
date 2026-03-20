---
name: tailwindcss
description:
    Build maintainable, design-system-aware UI with Tailwind CSS using current
    CSS-first tokens, utility composition, responsive variants, and clean class
    strategies. Use when working on Tailwind-based styling, theme tokens,
    responsive layouts, or utility-first component patterns.
---

# Tailwind CSS

Use this skill when building or refactoring Tailwind-based UI.

Read [tailwind-patterns.md](references/tailwind-patterns.md) when you need the
current framework patterns and token guidance.

## Default Approach

- Use utilities to compose real designs, not to copy template soup.
- Prefer a coherent token system over one-off arbitrary values everywhere.
- Keep class lists purposeful and readable.
- Use responsive and state variants deliberately, not mechanically.
- Let Tailwind accelerate a design system, not replace having one.

## Core Rules

- Start from layout, spacing, typography, and color hierarchy before
  micro-details.
- Prefer theme tokens and CSS variables for repeated values.
- Use arbitrary values only when the design truly needs a one-off value.
- Keep utility combinations semantically stable enough that future edits are
  predictable.
- Avoid generating class names dynamically in ways Tailwind cannot detect
  reliably.

## Workflow

### 1. Establish the tokens

Before styling heavily, decide:

- color roles
- type scale
- spacing rhythm
- radii and shadows
- breakpoints or responsive shifts

In current Tailwind, prefer CSS-first theme variables where that fits the
project.

### 2. Compose the structure

Build the layout first:

- stack and grid relationships
- primary vs secondary regions
- responsive reflow points
- empty and dense states

### 3. Add visual hierarchy

Use utilities to create hierarchy through:

- size
- weight
- contrast
- spacing
- alignment

Avoid solving hierarchy with color alone.

### 4. Refine interaction states

Use state and responsive variants intentionally:

- hover
- focus
- active
- disabled
- breakpoint-specific changes
- motion and reduced-motion support where relevant

### 5. Control reuse

When utility duplication becomes meaningful:

- first check whether duplication is acceptable and local
- if not, extract a small reusable component or local abstraction
- do not prematurely invent a large component API just to reduce a few class
  names

## Quality Checklist

- the class composition expresses a coherent design system
- repeated values are tokenized where appropriate
- arbitrary values are rare and justified
- responsive behavior is intentional
- classes remain readable enough to maintain
- the result does not feel like anonymous template Tailwind
