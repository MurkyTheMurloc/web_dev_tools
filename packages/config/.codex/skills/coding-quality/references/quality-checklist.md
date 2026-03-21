# Quality Checklist

Use this as a final pass before finishing an implementation.

## Structure

- Does each module have a single clear responsibility?
- Are long functions split where that improves comprehension?
- Is control flow easy to follow without jumping around too much?

## Extensibility

- If the next feature landed tomorrow, where would it go?
- Are there clear seams for new variants, policies, or integrations?
- Did we avoid baking volatile decisions into low-level code?

## Readability

- Do names explain intent rather than implementation detail?
- Are the main paths obvious on a quick scan?
- Are comments sparse and useful instead of narrating the code?

## Correctness Boundaries

- Are input validation, error handling, and fallback behavior explicit?
- Are edge cases handled at the right layer?
- Are side effects isolated enough to test confidently?

## Best Practices

- Does the code look idiomatic for the language?
- Does it follow the framework and repository patterns already in use?
- Did we avoid adding unnecessary abstraction or indirection?
