import { defineConfig } from "vitest/config";

// Every case runs oxlint on a fixture (about half a second), a fix case up to
// five times in a row, and the test files run in parallel on one machine: the
// default of five seconds is too tight.
const TEST_TIMEOUT_MS = 60_000;

export default defineConfig({
    test: {
        hookTimeout: TEST_TIMEOUT_MS,
        include: ["tests/**/*.test.mjs"],
        testTimeout: TEST_TIMEOUT_MS,
    },
});
