# When To Mock

Mock at system boundaries only:

- external APIs
- clocks and randomness
- filesystem where isolation is needed
- infrastructure you do not control

Avoid mocking:

- your own classes or modules
- internal collaborators
- private helpers

## Designing For Mockability

At boundaries, prefer dependency injection.

```ts
export function processPayment(order: Order, paymentClient: PaymentClient) {
    return paymentClient.charge(order.total);
}
```

This is easier to test than constructing the dependency internally.

Also prefer explicit SDK-style interfaces over generic fetch wrappers.

```ts
const api = {
    getUser: (id: string) => fetch(`/users/${id}`),
    getOrders: (userId: string) => fetch(`/users/${userId}/orders`),
};
```

This keeps mocks simple, local, and type-safe.
