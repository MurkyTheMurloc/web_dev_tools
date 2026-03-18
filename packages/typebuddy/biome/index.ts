const resolveAsset = (asset: string): string =>
  decodeURIComponent(new URL(asset, import.meta.url).pathname);

export const MaybePromiseRule: string = resolveAsset("./maybe_promise_rule.grit");
export const OptionalRule: string = resolveAsset("./optional_rule.gritt");
export const TryCatchAsyncRule: string = resolveAsset("./require-try-catch-async.grit");
