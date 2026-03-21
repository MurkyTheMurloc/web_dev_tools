// This file is intentionally valid for framework-style top-level handlers.
// The typebuddy async rules should not rewrite or report on this callback.

declare const app: {
    use(
        handler: (c: unknown, next: () => Promise<unknown>) => Promise<unknown>,
    ): void;
};

declare function contextStorageRun<T>(
    context: unknown,
    callback: () => Promise<T>,
): Promise<T>;

app.use(async (c, next) => {
    try {
        await contextStorageRun(c, () => {
            try {
                return next();
            } catch {
                return FAILED_PROMISE;
            }
        });
    } catch {
        return FAILED_PROMISE;
    }
});
