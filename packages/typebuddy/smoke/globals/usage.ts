import { err, ok } from "@murky-web/typebuddy";
import type {
    Optional as ImportedOptionalType,
    ResolveOptional as ImportedResolveOptionalType,
} from "@murky-web/typebuddy";

type ImportedOptional = ImportedOptionalType<string>;
type ImportedResolveOptional = ImportedResolveOptionalType<
    string,
    ImportedOptional
>;

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
    isError: false,
    value: "x",
});
const okValue = ok("x");
const okVoid = ok();
const errValue = err();
const importedOptionalValue: ImportedOptional = undefined;
const importedResolvedValue: ImportedResolveOptional = "x";

export {
    errValue,
    importedOptionalValue,
    importedResolvedValue,
    maybeValue,
    nullableValue,
    okValue,
    okVoid,
    optionalValue,
    parsed,
    promiseValue,
};
