---
name: frontend-design
description:
    Design or redesign frontend UI with a clear visual point of view, strong
    hierarchy, and purposeful interaction design. Use when the user wants
    interface design help, visual redesign, landing pages, dashboards, component
    polish, or frontend UX direction.
---

# Frontend Design

Use this skill when designing or redesigning user interfaces.

The goal is not just to make something clean, but to make it intentional,
legible, and memorable.

This skill should push toward professional, independent design language instead
of default framework aesthetics or template-library sameness.

Read [design-playbook.md](references/design-playbook.md) when you need concrete
starting directions instead of abstract design language.

If the UI already has a direction and mainly needs refinement, taste, and
anti-generic cleanup, use
[../frontend-taste/SKILL.md](../frontend-taste/SKILL.md) as the second pass
instead of stretching this skill to do both jobs.

## Default Design Principles

- Avoid generic AI-looking layouts.
- Avoid looking like a stock component demo or design-system placeholder.
- Start with a clear visual direction before writing components.
- Build strong hierarchy through spacing, scale, contrast, and grouping.
- Prefer one strong concept over many weak decorative ideas.
- Keep the UI usable on desktop and mobile.

If you do not know design well yet, do not try to invent everything from
scratch. Pick one direction from the playbook and commit to it.

## Process

### 1. Identify the role of the screen

Clarify what the UI needs to do:

- landing page
- dashboard
- settings
- content surface
- workflow step
- detail view

This determines the hierarchy and density.

### 2. Choose a visual direction

Before implementation, decide:

- typography character
- color system
- layout rhythm
- interaction tone
- background treatment
- whether the interface should feel editorial, product-like, utilitarian,
  premium, playful, or severe

Write these down briefly in the code through CSS variables, tokens, or comments
only where that meaning would otherwise be lost.

If you are unsure, choose from the playbook instead of inventing a label
yourself.

### 3. Design hierarchy first

Prioritize:

- what the user should notice first
- what actions matter most
- what information can be secondary
- where breathing room improves comprehension

If everything is equally loud, nothing is clear.

### 4. Add motion carefully

Use motion to reinforce structure:

- reveal hierarchy
- confirm actions
- soften layout changes

Do not add decorative micro-animations just because motion is available.

### 5. Refine against common failure modes

Check for:

- flat, default-looking layouts
- weak typography choices
- too many neutrals with no focal color
- overuse of cards without clear structure
- spacing that feels cramped or arbitrary
- mobile layouts that merely shrink desktop composition
- interfaces that look like generic library starter content
- local styling decisions that never add up to a recognizable point of view

### 6. Use the non-designer fallback

If you feel lost:

1. choose one direction from the playbook
2. choose one accent color family
3. define three text tiers
4. define three spacing tiers
5. make one region visually dominant
6. simplify everything that competes with it

## Working Rules

- Preserve an existing design system when one already exists.
- If there is no design system, create a small, coherent one instead of ad hoc
  styling.
- Prefer an independent visual language over the default look of the CSS
  framework in use.
- Prefer CSS variables or tokens for repeated values.
- Keep components expressive but not over-abstracted.
- When proposing alternatives, make them meaningfully different, not tiny
  variations.

## Quality Checklist

- the page has a visible point of view
- typography and spacing establish hierarchy
- mobile and desktop both feel intentional
- color is used to guide attention, not just decorate
- motion supports comprehension
- the result does not feel like interchangeable template UI
- the result could plausibly belong to a specific product, not any product
- if a non-designer followed the playbook, the result would still feel
  intentional
