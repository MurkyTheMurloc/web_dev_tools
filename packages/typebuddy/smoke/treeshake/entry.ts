import { isString } from "@murky-web/typebuddy";

const candidate: unknown = "hello";

if (isString(candidate)) {
    console.log(candidate.toUpperCase());
}
