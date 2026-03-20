# Tailwind CSS Patterns

Grounded in current Tailwind documentation.

## Theme Tokens

- Tailwind's current direction is CSS-first configuration.
- Prefer `@theme` variables for design tokens such as colors, fonts, spacing,
  shadows, and motion values.
- Reuse those tokens consistently instead of scattering one-off values.

## Utility Composition

- Tailwind is utility-first, but utility-first does not mean
  design-by-random-accumulation.
- Compose utilities around layout, typography, spacing, and state in a
  predictable order.
- Keep class strings understandable for the next edit.

## Arbitrary Values

- Arbitrary values are powerful, but should be used deliberately.
- Use them for genuinely custom needs, not as a substitute for token discipline.

## Responsive Design

- Use breakpoint variants to change layout and density intentionally.
- Treat mobile and desktop as distinct compositions, not just resized versions
  of the same thing.

## Class Detection

- Tailwind scans source files as plain text.
- Avoid generating class names dynamically in ways the scanner cannot see.
- Prefer explicit class strings or explicit lookup objects over opaque runtime
  concatenation.

## Reuse

- Start with local utility composition.
- Extract components or wrappers when duplication becomes meaningful.
- Do not over-abstract too early just to shorten class lists.
