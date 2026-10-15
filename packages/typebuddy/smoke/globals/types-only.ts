// Never imports the package: every global here must come from the
// `types` entry in tsconfig.types.json, the way consumers opt in. The
// smoke script symlinks the package into ./node_modules because `types`
// resolves through node_modules only, never by self-reference.
const optionalValue: Optional<string> = undefined;
const maybeValue: Maybe<string> = null;
const nullableValue: Nullable<string> = null;
const parsed = JSON.parse<{ value: string }>(JSON.stringify({ value: "x" }));

void optionalValue;
void maybeValue;
void nullableValue;
void parsed;
