---
name: find-docs
description: >-
    Retrieves authoritative, up-to-date technical documentation, API references,
    configuration details, and code examples for any developer technology.

    Use this skill whenever answering technical questions or writing code that
    interacts with external technologies. This includes libraries, frameworks,
    programming languages, SDKs, APIs, CLI tools, cloud services, infrastructure
    tools, and developer platforms.

    Common scenarios: - looking up API endpoints, classes, functions, or method
    parameters - checking configuration options or CLI commands - answering "how
    do I" technical questions - generating code that uses a specific library or
    service - debugging issues related to frameworks, SDKs, or APIs - retrieving
    setup instructions, examples, or migration guides - verifying
    version-specific behavior or breaking changes

    Prefer this skill whenever documentation accuracy matters or when model
    knowledge may be outdated.
---

# Documentation Lookup

Retrieve current documentation and code examples for any library using the
Context7 CLI.

Prefer Bun-first commands in this environment:

```bash
bunx @upstash/context7@latest <command>
```

If Bun is not available in the target environment, the npm fallback is:

```bash
npx @upstash/context7@latest <command>
```

## Workflow

Two-step process: resolve the library name to an ID, then query docs with that
ID.

```bash
bunx @upstash/context7@latest library <name> <query>
bunx @upstash/context7@latest docs <libraryId> <query>
```

You MUST resolve a library ID first unless the user already provides a valid
Context7 library ID in the format `/org/project` or `/org/project/version`.

Do not run more than three Context7 lookups per question unless the user
explicitly asks for broader exploration.

## Step 1: Resolve A Library

Use the query to disambiguate the library:

```bash
bunx @upstash/context7@latest library react "How to clean up useEffect with async operations"
bunx @upstash/context7@latest library nextjs "How to set up app router with middleware"
bunx @upstash/context7@latest library prisma "How to define one-to-many relations with cascade delete"
```

Selection priorities:

- exact or near-exact name match
- description relevance
- stronger documentation coverage
- better source reputation
- better benchmark score

If the user mentions a specific version, prefer the closest matching
version-specific library ID.

## Step 2: Query Documentation

Once you have the ID, query documentation with the user's actual intent:

```bash
bunx @upstash/context7@latest docs /facebook/react "How to clean up useEffect with async operations"
bunx @upstash/context7@latest docs /vercel/next.js "How to add authentication middleware to app router"
```

Prefer full, descriptive queries over one-word prompts.

## Error Handling

If Context7 fails because of quota:

1. tell the user the Context7 quota is exhausted
2. suggest authentication for higher limits if relevant
3. if you must answer from memory, say clearly that it may be outdated

Do not silently fall back to stale knowledge.

## Common Mistakes

- forgetting the leading `/` in the library ID
- skipping the resolve step
- using vague one-word queries
- putting secrets or private data into the query
