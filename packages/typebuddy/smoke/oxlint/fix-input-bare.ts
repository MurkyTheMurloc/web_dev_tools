// A leading comment and no imports at all.
//
// The insertion point used to be classified by the anchor's byte offset, so a
// comment that pushed the first statement off zero flipped the branch and the
// import was emitted with a leading newline instead of a trailing one — landing
// glued to the statement it was inserted before.
export async function needsHelpers(): AsyncResult<string> {
    try {
        return "value";
    } catch {}
}
