function resolveAsset(asset: string): string {
  return decodeURIComponent(new globalThis.URL(asset, import.meta.url).pathname);
}

const MaybePromiseRule: string = resolveAsset("./maybe_promise_rule.grit");
const OptionalRule: string = resolveAsset("./optional_rule.gritt");
const TryCatchAsyncRule: string = resolveAsset("./require-try-catch-async.grit");

export { MaybePromiseRule, OptionalRule, TryCatchAsyncRule };
