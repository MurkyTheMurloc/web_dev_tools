type OptionalCase = Optional<string>;
type MaybeCase = Maybe<string>;
type NullableCase = Nullable<string>;
type PromiseCase = MaybePromise<string>;

const serialized = JSON.stringify({ value: "x" });
const parsed = JSON.parse<{ value: string }>(serialized);

const optionalValue: OptionalCase = undefined;
const maybeValue: MaybeCase = null;
const nullableValue: NullableCase = null;
const promiseValue: PromiseCase = Promise.resolve({
  value: "x",
  isError: false,
});

void optionalValue;
void maybeValue;
void nullableValue;
void promiseValue;
void parsed;
