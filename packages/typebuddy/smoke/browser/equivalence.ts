// Runs in the page that smoke/browser/run.ts opens in headless Chromium: the
// prefer-guards equivalence cases with the values only a browser has. The
// result goes into <pre id="result"> as JSON, which `--dump-dom` prints.

import { isEmptyLike } from "../../src/empty.js";
import {
    DOCUMENT_ALL_EXCLUDED,
    MAPPED,
    edgeValues,
    findMismatches
} from "../../tests/guard_equivalence_cases.js";

type Realm = typeof globalThis;

function foreignRealm(): Realm | null {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const realm: unknown = frame.contentWindow;
    return realm === null ? null : (realm as Realm);
}

function browserValues(): Array<readonly [string, unknown]> {
    const values: Array<readonly [string, unknown]> = [
        ["document.all", document.all],
        ["document", document],
        ["document.body", document.body],
        ["window", window]
    ];

    // Values from another realm: `instanceof` sees another `Error`, `Array.isArray`
    // still sees an array. Native and guard must still agree.
    const realm = foreignRealm();
    if (realm !== null) {
        values.push(
            ["iframe []", new realm.Array()],
            ["iframe new Error()", new realm.Error("e")],
            ["iframe new Date()", new realm.Date()],
            ["iframe /x/", new realm.RegExp("x")],
            ["iframe function", new realm.Function("return 1")]
        );
    }

    return values;
}

const all = document.all;
const values = [...edgeValues(), ...browserValues()];
const documentAll: Array<readonly [string, unknown]> = [["document.all", all]];

const result = {
    // Proof that this engine has the special value at all.
    documentAll: {
        typeofIsUndefined: typeof all === "undefined",
        strictEqualsUndefined: all === undefined,
        // oxlint-disable-next-line eqeqeq
        looseEqualsNull: all == null
    },
    valueCount: values.length,
    mappedPairs: MAPPED.length,
    mappedMismatches: findMismatches(MAPPED, values),
    // Each of these must disagree on document.all, or excluding it is wrong.
    excludedAgreeingOnDocumentAll: DOCUMENT_ALL_EXCLUDED.filter(
        (pair) => findMismatches([pair], documentAll).length === 0
    ).map(([name]) => name),
    // The other edge values agree for the excluded pairs too: document.all is
    // the only reason.
    excludedMismatchesWithoutDocumentAll: findMismatches(
        DOCUMENT_ALL_EXCLUDED,
        values.filter(([name]) => name !== "document.all")
    ),
    isEmptyLikeDocumentAll: isEmptyLike(all)
};

const output = document.querySelector("#result");
if (output !== null) {
    output.textContent = JSON.stringify(result);
}
