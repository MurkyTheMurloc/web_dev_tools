---
name: ubiquitous-language
description:
    Extract a DDD-style ubiquitous language glossary from the current
    conversation, flag ambiguities, and propose canonical terms. Use when the
    user wants to define domain terms, harden terminology, create a glossary, or
    mentions domain modeling or DDD.
---

# Ubiquitous Language

Extract and formalize domain terminology from the current conversation into a
consistent glossary saved to `UBIQUITOUS_LANGUAGE.md`.

## Process

1. Scan the conversation for domain-relevant nouns, verbs, and concepts.
2. Identify terminology problems:
    - the same word used for different concepts
    - different words used for the same concept
    - vague or overloaded terms
3. Propose a canonical glossary with opinionated term choices.
4. Write `UBIQUITOUS_LANGUAGE.md` in the working directory using the format
   below.
5. Summarize the result inline in the conversation.

## Output Format

Write `UBIQUITOUS_LANGUAGE.md` with this structure:

```md
# Ubiquitous Language

## Order lifecycle

| Term        | Definition                                              | Aliases to avoid      |
| ----------- | ------------------------------------------------------- | --------------------- |
| **Order**   | A customer's request to purchase one or more items      | Purchase, transaction |
| **Invoice** | A request for payment sent to a customer after delivery | Bill, payment request |

## People

| Term         | Definition                                  | Aliases to avoid       |
| ------------ | ------------------------------------------- | ---------------------- |
| **Customer** | A person or organization that places orders | Client, buyer, account |
| **User**     | An authentication identity in the system    | Login, account         |

## Relationships

- An **Invoice** belongs to exactly one **Customer**
- An **Order** produces one or more **Invoices**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the
> **Invoice** immediately?" **Domain expert:** "No. An **Invoice** is generated
> once a **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User**. Use **Customer**
  for the business actor and **User** for the authentication identity.
```

## Rules

- Be opinionated. Pick the canonical term and list the others as aliases to
  avoid.
- Flag conflicts explicitly.
- Keep definitions tight: one sentence max.
- Define what the thing is, not what it does.
- Show relationships where they are clear.
- Only include domain terms, not generic programming vocabulary unless it has
  domain meaning.
- Group terms when natural clusters appear, but do not force artificial
  sections.
- Include a short example dialogue showing the terms used precisely.

## Re-running

When invoked again in the same conversation:

1. Read the existing `UBIQUITOUS_LANGUAGE.md`.
2. Incorporate new terms from subsequent discussion.
3. Update definitions if understanding has evolved.
4. Mark changed entries with `(updated)` and new entries with `(new)`.
5. Re-flag new ambiguities.
6. Rewrite the example dialogue to include the new terms.

## Post-output Instruction

After writing the file, state:

> I've written or updated `UBIQUITOUS_LANGUAGE.md`. From this point forward I
> will use these terms consistently. If I drift from this language or you notice
> a term that should be added, let me know.
