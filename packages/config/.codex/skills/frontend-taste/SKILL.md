---
name: frontend-taste
description:
    Refine frontend work to feel more intentional, distinctive, and high-quality
    by removing generic, overstimulating, or template-like choices. Use after
    initial UI direction exists, especially together with frontend-design and
    tailwindcss.
---

# Frontend Taste

Use this skill as a second pass after a UI already has basic structure.

This skill is not for inventing a design from nothing. It is for improving
taste, restraint, cohesion, and product character once a direction exists.

Use [../frontend-design/SKILL.md](../frontend-design/SKILL.md) first when the
visual direction is still unclear. If the project uses Tailwind, also follow
[../tailwindcss/SKILL.md](../tailwindcss/SKILL.md).

Read [taste-review.md](references/taste-review.md) when you need a concrete
review checklist instead of relying on instinct.

## Goal

Make the design feel more:

- intentional
- distinctive
- refined
- product-specific
- calm enough to read

without making it generic, empty, or timid.

## Context Gathering

Before changing anything, identify:

- what the screen is for
- who it is for
- what already works
- what currently feels generic, noisy, or emotionally mismatched
- whether an existing design system or brand language must be preserved

If there is no clear design direction yet, stop and use `frontend-design` first.

## Common Taste Failures

Look for these issues:

- template-looking card grids with weak hierarchy
- too many accents, gradients, shadows, or glass effects at once
- typography that feels default or emotionally neutral everywhere
- every section using the same visual treatment
- spacing that is technically okay but has no rhythm
- oversized radii and soft shadows used as a substitute for design
- “premium” attempts that are really just blur, dark backgrounds, and glow
- dashboards or app UIs that look like landing pages
- loud color without a clear job
- components that feel library-native instead of product-native

## Taste Dials

Use these dials deliberately instead of changing random details:

- `restraint`: how quiet or bold should the interface feel?
- `contrast`: where should the eye be pulled first?
- `density`: should this feel spacious, tight, editorial, or operational?
- `texture`: should surfaces feel flat, tactile, glossy, or almost absent?
- `warmth`: should the palette feel cool, neutral, warm, serious, or playful?

Do not max every dial at once.

## Refinement Process

### 1. Keep one strong idea

Choose one or two defining characteristics and reinforce them.

Examples:

- severe typography with quiet surfaces
- warm neutrals with sharp product accents
- editorial spacing with compact controls
- dense tooling UI with one strong highlight color

Remove decorative ideas that do not support the core direction.

### 2. Improve hierarchy before decoration

First improve:

- type scale
- spacing rhythm
- grouping
- contrast placement
- surface depth

Only then consider decorative details.

### 3. Make components feel owned

Push components away from “default framework output”:

- adjust spacing and proportions
- create a consistent radius strategy
- standardize border and shadow logic
- avoid mixing too many component moods on one screen

### 4. Use color with discipline

- let neutrals do more work
- give accents a clear role
- avoid equal emphasis everywhere
- use tinted neutrals when they create a more coherent atmosphere

### 5. Reduce overstimulation

If the interface feels loud:

- reduce saturation
- lower effect density
- simplify surface layering
- shorten motion distance
- keep only the strongest emphasis points

### 6. Add one memorable move

Taste is not only restraint. Add one deliberate, product-specific move:

- a strong hero composition
- unusual but clear typography pairings
- a specific framing device
- a distinctive navigation treatment
- a recognizable background structure

Do not add five.

## Never

- do not cargo-cult Dribbble or screenshot aesthetics without product logic
- do not use gradients, glass, glow, or noise as a shortcut to “high quality”
- do not make everything large, soft, and rounded by default
- do not solve blandness by just adding more color
- do not break usability in pursuit of style
- do not destroy an existing design system just to make one screen “cooler”

## Quality Checklist

- the UI still feels like the same product, just better
- there is a visible point of view
- hierarchy is stronger than before
- decorative choices now serve the concept
- the result feels less generic and less overstimulating
- the design has at least one memorable characteristic
- if the same screen were shown without branding, it would still feel chosen
