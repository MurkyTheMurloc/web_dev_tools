// A leading comment and no imports at all.
//
// The insertion point used to be classified by the anchor's byte offset, so a
// comment that pushed the first statement off zero flipped the branch and the
// import was emitted with a leading newline instead of a trailing one — landing
// glued to the statement it was inserted before.
import { ok } from "@murky-web/typebuddy";
import { err } from "@murky-web/typebuddy";
export async function needsHelpers(): AsyncResult<string> {
    try {
        return ok("value");
    } catch {
        return err();
    }
}
