// Never imports the package: every global here must come from the
// `types` entry in tsconfig.types.json, the way consumers opt in. The
// smoke script symlinks the package into ./node_modules because `types`
// resolves through node_modules only, never by self-reference.
const optionalValue: Optional<string> = undefined;
const maybeValue: Maybe<string> = null;
const nullableValue: Nullable<string> = null;
const serialized = JSON.stringify({ value: "x" });
const parsed = JSON.parse<{ value: string }>(serialized);

export { maybeValue, nullableValue, optionalValue, parsed };
