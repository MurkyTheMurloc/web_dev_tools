const resolveAsset = (asset: string) =>
  decodeURIComponent(new URL(asset, import.meta.url).pathname);

export const MaybePromiseRule = resolveAsset("./maybe_promise_rule.grit");
export const OptionalRule = resolveAsset("./optional_rule.gritt");
export const TryCatchAsyncRule = resolveAsset("./require-try-catch-async.grit");
