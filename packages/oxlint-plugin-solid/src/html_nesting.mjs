// Which element may sit inside which, and which invalid nestings the HTML
// parser repairs by moving or dropping elements.
//
// `isValidHTMLNesting` is the data of validate-html-nesting 1.2.4, the package
// that eslint-plugin-solid 0.20 uses, and is covered by its licence:
//
// ISC License
//
// Copyright (c) Manan Tank
//
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
// AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
// LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
// OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
// PERFORMANCE OF THIS SOFTWARE.
//
// eslint-plugin-solid also asks parse5 what the parser does with a pair; this
// plugin has no parser dependency, so `restructures` is the same answer written
// down: for each parent, the children the parser does not keep as written (the
// "in body", "in table", "in select" and "in head" insertion modes of the HTML
// standard, and the way foreign content ends at an HTML element).

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const EMPTY = new Set();

/** Maps an element to the only elements that may be its children. */
const ONLY_VALID_CHILDREN = new Map([
    [
        "head",
        new Set([
            "base",
            "basefront",
            "bgsound",
            "link",
            "meta",
            "title",
            "noscript",
            "noframes",
            "style",
            "script",
            "template",
        ]),
    ],
    [
        "option",
        new Set([
            "div",
            "a",
            "abbr",
            "area",
            "audio",
            "b",
            "bdi",
            "bdo",
            "br",
            "canvas",
            "cite",
            "code",
            "data",
            "del",
            "dfn",
            "em",
            "i",
            "img",
            "input",
            "ins",
            "kbd",
            "link",
            "map",
            "mark",
            "math",
            "meta",
            "meter",
            "noscript",
            "output",
            "picture",
            "progress",
            "q",
            "ruby",
            "s",
            "samp",
            "script",
            "slot",
            "small",
            "span",
            "strong",
            "sub",
            "sup",
            "svg",
            "template",
            "time",
            "u",
            "var",
            "video",
            "wbr",
        ]),
    ],
    [
        "optgroup",
        new Set(["option", "legend", "script", "template", "noscript", "div"]),
    ],
    [
        "select",
        new Set([
            "optgroup",
            "option",
            "hr",
            "button",
            "script",
            "template",
            "noscript",
            "div",
        ]),
    ],
    ["math", new Set(["mrow"])],
    ["table", new Set(["caption", "colgroup", "tbody", "tfoot", "thead"])],
    ["tr", new Set(["td", "th"])],
    ["colgroup", new Set(["col"])],
    ["tbody", new Set(["tr"])],
    ["thead", new Set(["tr"])],
    ["tfoot", new Set(["tr"])],
    // These elements cannot have child elements at all.
    ["script", EMPTY],
    ["iframe", EMPTY],
    ["textarea", EMPTY],
    ["style", EMPTY],
    ["title", EMPTY],
    ["selectedcontent", EMPTY],
]);

/** Maps an element to the only elements that may be its parent. */
const ONLY_VALID_PARENTS = new Map([
    ["html", EMPTY],
    ["body", new Set(["html"])],
    ["head", new Set(["html"])],
    ["td", new Set(["tr"])],
    ["colgroup", new Set(["table"])],
    ["caption", new Set(["table"])],
    ["tbody", new Set(["table"])],
    ["tfoot", new Set(["table"])],
    ["col", new Set(["colgroup"])],
    ["th", new Set(["tr"])],
    ["thead", new Set(["table"])],
    ["tr", new Set(["tbody", "thead", "tfoot"])],
    ["dd", new Set(["dl", "div"])],
    ["dt", new Set(["dl", "div"])],
    ["figcaption", new Set(["figure"])],
    ["summary", new Set(["details"])],
    ["area", new Set(["map"])],
    ["selectedcontent", new Set(["button"])],
]);

/** Maps an element to the elements that may not be its children; others may. */
const KNOWN_INVALID_CHILDREN = new Map([
    [
        "p",
        new Set([
            "address",
            "article",
            "aside",
            "blockquote",
            "center",
            "details",
            "dialog",
            "dir",
            "div",
            "dl",
            "fieldset",
            "figure",
            "footer",
            "form",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "header",
            "hgroup",
            "hr",
            "li",
            "main",
            "nav",
            "menu",
            "ol",
            "p",
            "pre",
            "section",
            "table",
            "ul",
        ]),
    ],
    [
        "svg",
        new Set([
            "b",
            "blockquote",
            "br",
            "code",
            "dd",
            "div",
            "dl",
            "dt",
            "em",
            "embed",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "hr",
            "i",
            "img",
            "li",
            "menu",
            "meta",
            "ol",
            "p",
            "pre",
            "ruby",
            "s",
            "small",
            "span",
            "strong",
            "sub",
            "sup",
            "table",
            "u",
            "ul",
            "var",
        ]),
    ],
]);

/** Maps an element to the elements that may not be its parent; others may. */
const KNOWN_INVALID_PARENTS = new Map([
    ["a", new Set(["a"])],
    ["button", new Set(["button"])],
    ["dd", new Set(["dd", "dt"])],
    ["dt", new Set(["dd", "dt"])],
    ["form", new Set(["form"])],
    ["li", new Set(["li"])],
    ["h1", HEADINGS],
    ["h2", HEADINGS],
    ["h3", HEADINGS],
    ["h4", HEADINGS],
    ["h5", HEADINGS],
    ["h6", HEADINGS],
]);

/**
 * Whether `child` directly inside `parent` is valid HTML.
 *
 * @param {string} parent Lower-case tag name
 * @param {string} child Lower-case tag name
 * @returns {boolean}
 */
export function isValidHTMLNesting(parent, child) {
    const onlyChildren = ONLY_VALID_CHILDREN.get(parent);
    if (onlyChildren) {
        return onlyChildren.has(child);
    }

    const onlyParents = ONLY_VALID_PARENTS.get(child);
    if (onlyParents) {
        return onlyParents.has(parent);
    }

    if (KNOWN_INVALID_CHILDREN.get(parent)?.has(child)) {
        return false;
    }

    return !KNOWN_INVALID_PARENTS.get(child)?.has(parent);
}

// A start tag that closes an open `<p>` (the standard's "close a p element").
const CLOSES_PARAGRAPH = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "center",
    "dd",
    "details",
    "dialog",
    "dir",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "li",
    "listing",
    "main",
    "menu",
    "nav",
    "ol",
    "p",
    "plaintext",
    "pre",
    "search",
    "section",
    "summary",
    "table",
    "ul",
    "xmp",
]);

// Elements that a table, a row or a row group keeps as its own children,
// whatever they are: scripts, templates and the (hidden) form controls. Every
// other child is moved in front of the table, or gets an implied wrapper.
const TABLE_KEEPS = ["form", "script", "style", "template"];
// What a `<head>` keeps; anything else ends it and goes to the body.
const HEAD_KEEPS = new Set([
    "base",
    "basefont",
    "bgsound",
    "link",
    "meta",
    "noframes",
    "noscript",
    "script",
    "style",
    "template",
    "title",
]);
// The table pieces and the document elements: a start tag of these is ignored
// where it does not belong, or closes what is open.
const IGNORED_OUTSIDE_THEIR_PARENT = new Set([
    "body",
    "caption",
    "col",
    "colgroup",
    "head",
    "html",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
]);
const IN_SELECT_KEEPS = new Set(["script", "template"]);
const RAW_TEXT_PARENTS = new Set([
    "iframe",
    "script",
    "style",
    "textarea",
    "title",
]);

/**
 * Whether the HTML parser, given `child` directly inside `parent`, builds a
 * tree where the child is not a child of the parent: it closes the parent,
 * drops the child, moves it elsewhere or puts another element between them.
 * Only meant for pairs that are not valid; the parent must be in the HTML
 * namespace (the rule does not look inside `<svg>` and `<math>`).
 *
 * @param {string} parent Lower-case tag name
 * @param {string} child Lower-case tag name
 * @returns {boolean}
 */
export function restructures(parent, child) {
    switch (parent) {
        case "template":
            // The content of a template is parsed in a mode of its own: the
            // parser keeps every element (`<tr>`, `<td>`, `<col>`, ...).
            return false;
        case "p":
            return CLOSES_PARAGRAPH.has(child) || isIgnoredStartTag(child);
        case "a":
        case "button":
        case "form":
        case "li":
            return child === parent || isIgnoredStartTag(child);
        case "dd":
        case "dt":
            return child === "dd" || child === "dt" || isIgnoredStartTag(child);
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
            return HEADINGS.has(child) || isIgnoredStartTag(child);
        case "svg":
            // Foreign content ends at these HTML elements.
            return KNOWN_INVALID_CHILDREN.get("svg")?.has(child) ?? false;
        case "table":
            return !isKept(child, [
                "caption",
                "colgroup",
                "tbody",
                "tfoot",
                "thead",
            ]);
        case "tr":
            return !isKept(child, ["td", "th"]);
        case "tbody":
        case "tfoot":
        case "thead":
            return !isKept(child, ["tr"]);
        case "colgroup":
            return child !== "col" && child !== "template";
        case "select":
            return !IN_SELECT_KEEPS.has(child);
        case "option":
            return child === "option" || child === "optgroup";
        case "head":
            return !HEAD_KEEPS.has(child);
        case "math":
            // Foreign content: the parser keeps most of what is in there.
            return false;
        default:
            break;
    }

    if (RAW_TEXT_PARENTS.has(parent)) {
        return true;
    }

    return isIgnoredStartTag(child);
}

function isKept(child, tags) {
    return tags.includes(child) || TABLE_KEEPS.includes(child);
}

function isIgnoredStartTag(child) {
    return IGNORED_OUTSIDE_THEIR_PARENT.has(child);
}
