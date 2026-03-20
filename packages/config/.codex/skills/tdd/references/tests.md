# Good and Bad Tests

## Good Tests

Integration-style tests verify observable behavior through real interfaces.

```ts
import { describe, expect, it } from "vitest";

describe("checkout", () => {
    it("confirms checkout for a valid cart", async () => {
        const cart = createCart();
        cart.add(product);

        const result = await checkout(cart, paymentMethod);

        expect(result.status).toBe("confirmed");
    });
});
```

Characteristics:

- tests behavior callers care about
- uses the public API
- survives internal refactors
- describes what the system does, not how it does it

## Edge-Case Expectations

Do not stop after proving only the happy path.

Once the primary behavior is green, look for realistic edge cases such as:

- empty values
- malformed input
- boundary values
- duplicate or repeated operations
- missing optional fields
- very large inputs
- ordering-sensitive data
- runtime quirks relevant to the platform

Example:

```ts
import { describe, expect, it } from "vitest";

describe("parseTags", () => {
    it("returns tags for a comma-separated string", () => {
        expect(parseTags("a,b")).toEqual(["a", "b"]);
    });

    it("ignores empty segments in a messy input", () => {
        expect(parseTags("a,, b,")).toEqual(["a", "b"]);
    });
});
```

The second test matters because messy user input is rare compared to the ideal
case, but still completely possible.

## Bad Tests

Implementation-detail tests couple themselves to internal structure.

```ts
import { describe, expect, it, vi } from "vitest";

describe("checkout", () => {
    it("calls paymentService.process", async () => {
        const process = vi.fn();
        const paymentService = { process };

        await checkout(cart, paymentService);

        expect(process).toHaveBeenCalledWith(cart.total);
    });
});
```

Red flags:

- mocking internal collaborators
- testing private methods
- asserting on call counts and order when behavior is what matters
- tests fail on harmless refactors
- only testing the golden path when credible edge cases exist

Also avoid verifying behavior by stepping around the interface:

```ts
it("makes a created user retrievable", async () => {
    const user = await createUser({ name: "Alice" });
    const retrieved = await getUser(user.id);

    expect(retrieved.name).toBe("Alice");
});
```
