# Architecture Reference

## Dependency Categories

When assessing a candidate for deepening, classify its dependencies:

### 1. In-process

Pure computation, in-memory state, no I/O.

Always deepenable. Merge the modules and test directly.

### 2. Local-substitutable

Dependencies that have local test stand-ins, such as PGLite for Postgres or an
in-memory filesystem.

Deepenable if the test substitute exists. Test the deepened module with the
local stand-in running in the suite.

### 3. Remote but owned

Your own services across a network boundary, such as internal APIs, queues, or
microservices.

Use ports and adapters:

- define a port at the module boundary
- keep the logic in the deep module
- inject the transport
- use an in-memory adapter in tests
- use the real HTTP, gRPC, or queue adapter in production

Recommendation shape:

`Define a shared interface (port), implement a production adapter and an in-memory test adapter, so the logic can be tested as one deep module even though it's deployed across a boundary.`

### 4. True external

Third-party services you do not control, such as Stripe or Twilio.

Mock at the boundary. The deepened module takes the external dependency as an
injected port, and tests provide a mock implementation.

## Testing Strategy

Core principle: replace, do not layer.

- old unit tests on shallow modules are waste once boundary tests exist
- write new tests at the deepened module interface boundary
- assert on observable behavior through the public interface
- the tests should survive internal refactors

## Refactor RFC Template

### Problem

- which modules are shallow and tightly coupled
- what integration risk exists in the seams between them
- why this makes the codebase harder to navigate and maintain

### Proposed Interface

- interface signature
- usage example
- what complexity it hides internally

### Dependency Strategy

- in-process
- local-substitutable
- ports and adapters
- mock

### Testing Strategy

- new boundary tests to write
- old tests to delete
- test environment needs

### Implementation Recommendations

- what the module should own
- what it should hide
- what it should expose
- how callers should migrate
