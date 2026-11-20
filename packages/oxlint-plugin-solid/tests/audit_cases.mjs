// Fixtures for the audit findings of 2026-11-19: rules that missed unsafe
// code and autofixes that wrote code that does not parse, does not compile or
// crashes at run time.
//
// `reports` and `silent` cases are linted once; `fixes` cases are linted with
// `--fix` (see `audit.test.mjs` for what each field means).

// A JSX attribute string does not process escapes, so the obfuscated URLs sit
// in an expression container, where `\t` is a real tab.
const scriptUrlReports = Object.freeze([
    Object.freeze({
        name: "a tab inside the scheme",
        code: String.raw`export const View = () => <a href={"java\tscript:alert(1)"}>x</a>;
`
    }),
    Object.freeze({
        name: "a newline in front of the scheme",
        code: String.raw`export const View = () => <a href={"\njavascript:alert(1)"}>x</a>;
`
    }),
    Object.freeze({
        name: "a control character in front of the scheme",
        code: String.raw`export const View = () => <a href={"\u0001javascript:alert(1)"}>x</a>;
`
    }),
    Object.freeze({
        name: "spaces in front of an upper-case scheme",
        code: String.raw`export const View = () => <a href={"  JavaScript:alert(1)"}>x</a>;
`
    })
]);

const scriptUrlSilent = Object.freeze([
    Object.freeze({
        name: "javascript: that does not start the value",
        code: `export const View = () => <a href="ABCjavascript:void(0)">x</a>;
`
    }),
    Object.freeze({
        name: "an https URL",
        code: `export const View = () => <a href="https://example.com">x</a>;
`
    })
]);

const PROPS_TYPE = `import type { JSX } from "@solidjs/web";

type Props = { readonly name: string };
`;

const preferArrowFixes = Object.freeze([
    Object.freeze({
        name: "export default function becomes a const and a default export",
        source: `${PROPS_TYPE}
export default function Page(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
        expectedFragments: [
            "const Page: Component<Props> = (props) => {",
            "export default Page;",
            'import type { Component } from "solid-js";'
        ],
        forbiddenFragments: ["export default const", "function Page"]
    }),
    Object.freeze({
        name: "two components without a solid-js import share one import at the top",
        source: `${PROPS_TYPE}
export function First(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}

export function Second(props: Props): JSX.Element {
    return <section>{props.children}</section>;
}
`,
        expectedFragments: [
            'import type { Component, ParentComponent } from "solid-js";',
            "export const First: Component<Props> = (props) => {",
            "export const Second: ParentComponent<Props> = (props) => {"
        ],
        forbiddenFragments: ["function First", "function Second"],
        singleFragments: ['from "solid-js"'],
        stable: true
    }),
    Object.freeze({
        name: "a nested component gets the import at the top of the file",
        source: `${PROPS_TYPE}
export const make = () => {
    function Inner(props: Props): JSX.Element {
        return <i>{props.name}</i>;
    }

    return Inner;
};
`,
        expectedFragments: ["const Inner: Component<Props> = (props) => {"],
        singleFragments: ['import type { Component } from "solid-js";'],
        // The import comes before every other statement.
        importBefore: "export const make"
    }),
    Object.freeze({
        name: "an import goes after a use client directive",
        source: `"use client";

export function Leaf(): JSX.Element {
    return <div />;
}
`,
        expectedFragments: [
            '"use client";\n\nimport type { Component } from "solid-js";',
            "export const Leaf: Component = () => {"
        ]
    })
]);

// Reported, but a fix would break the module: the report stays and the source
// does not change.
const preferArrowUnfixed = Object.freeze([
    Object.freeze({
        name: "a function used before its declaration (the const would be in its dead zone)",
        source: `${PROPS_TYPE}
export const routes = [{ component: Home }];

export function Home(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
        ruleId: "prefer-arrow-components"
    }),
    Object.freeze({
        name: "a function used in JSX before its declaration",
        source: `${PROPS_TYPE}
export const App = () => {
    return <Home name="x" />;
};

export function Home(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
        ruleId: "prefer-arrow-components"
    })
]);

const noDestructureFixes = Object.freeze([
    Object.freeze({
        name: "a destructured prop used as a shorthand property keeps its key",
        source: `declare function use(options: object): string;

export const Panel = ({ title, data }) => {
    return <div>{use({ title, data })}</div>;
};
`,
        expectedFragments: ["{ title: props.title, data: props.data }"],
        forbiddenFragments: ["{ props.title", "= ({ title"]
    }),
    Object.freeze({
        name: "a shorthand property next to a default",
        source: `declare function use(options: object): string;

export const Panel = ({ title = "x" }) => {
    return <div>{use({ title })}</div>;
};
`,
        expectedFragments: ["{ title: props.title }", "merge({ title:"]
    }),
    Object.freeze({
        name: "an inner component does not shadow the props of the outer one",
        source: `export const Outer = (props) => {
    const Inner = ({ label }) => <b>{props.id}{label}</b>;

    return <Inner label="x" />;
};
`,
        expectedFragments: ["(props2) =>", "props.id", "props2.label"],
        forbiddenFragments: ["props.label", "({ label"]
    }),
    Object.freeze({
        name: "an inner component picks a name that its body does not read from outside",
        source: `const props = { id: 1 };

export const Panel = ({ label }) => {
    return <b>{props.id}{label}</b>;
};
`,
        expectedFragments: ["(props2) =>", "props.id", "props2.label"]
    }),
    Object.freeze({
        name: "a callback inside the component with its own props parameter keeps its reads",
        source: `export const Panel = ({ title, items }) => {
    return (
        <For each={items}>
            {(props) => <li>{props.x}{title}</li>}
        </For>
    );
};
`,
        expectedFragments: [
            "(props2) =>",
            "each={props2.items}",
            "{props2.title}",
            "{props.x}",
            "{(props) =>"
        ],
        forbiddenFragments: ["{props.title}", "props.items"]
    }),
    Object.freeze({
        name: "a callback inside the component with its own props variable keeps its reads",
        source: `export const Panel = ({ title, items }) => {
    return (
        <ul>
            {items.map((item) => {
                const props = { x: item };

                return <li>{props.x}{title}</li>;
            })}
        </ul>
    );
};
`,
        expectedFragments: [
            "(props2) =>",
            "props2.items.map",
            "{props2.title}",
            "{props.x}",
            "const props = { x: item }"
        ],
        forbiddenFragments: ["{props.title}", "props.items"]
    })
]);

// A nested pattern, a computed key that is not a literal and a write to a
// destructured name cannot be rewritten without changing what the code does.
const noDestructureUnfixed = Object.freeze([
    Object.freeze({
        name: "a nested pattern",
        source: `export const Card = ({ user: { name }, id }) => {
    return <p>{name}{id}</p>;
};
`,
        ruleId: "no-destructure"
    }),
    Object.freeze({
        name: "a computed key that is not a literal",
        source: `const key = "a";

export const Row = ({ [key]: label, ...rest }) => {
    return <p {...rest}>{label}</p>;
};
`,
        ruleId: "no-destructure"
    }),
    Object.freeze({
        name: "a write to a destructured name",
        source: `export const Counter = ({ count }) => {
    count += 1;

    return <p>{count}</p>;
};
`,
        ruleId: "no-destructure"
    })
]);

const importsFixes = Object.freeze([
    Object.freeze({
        name: "a type from a type import joins a value import with type",
        source: `import { render } from "@solidjs/web";
import type { JSX } from "solid-js";

export const rendered = [render];
export type Node = JSX.Element;
`,
        expectedFragments: ['import { render, type JSX } from "@solidjs/web";'],
        forbiddenFragments: ['import type { JSX } from "solid-js"']
    }),
    Object.freeze({
        name: "a value does not join a type import",
        source: `import type { JSX } from "@solidjs/web";
import { render } from "solid-js";

export const rendered = [render];
export type Node = JSX.Element;
`,
        expectedFragments: [
            'import type { JSX } from "@solidjs/web";',
            'import { render } from "@solidjs/web";'
        ],
        forbiddenFragments: ["JSX, render", "render, JSX"],
        stable: true
    }),
    Object.freeze({
        name: "an inline type does not keep its modifier in a type import",
        source: `import type { RequestEvent } from "@solidjs/web";
import { type JSX, createSignal } from "solid-js";

export const signal = createSignal;
export type Node = JSX.Element;
export type Event = RequestEvent;
`,
        expectedFragments: [
            'import type { RequestEvent, JSX } from "@solidjs/web";',
            'import { createSignal } from "solid-js";'
        ],
        forbiddenFragments: ["type JSX }", "type JSX,"],
        stable: true
    }),
    Object.freeze({
        name: "a value with an alias keeps the alias in a new declaration",
        source: `import type { JSX } from "@solidjs/web";
import { render as draw } from "solid-js";

export const drawn = [draw];
export type Node = JSX.Element;
`,
        expectedFragments: [
            'import type { JSX } from "@solidjs/web";',
            'import { render as draw } from "@solidjs/web";'
        ],
        stable: true
    }),
    Object.freeze({
        name: "the last specifier of an import leaves no dangling comma",
        source: `import { createSignal, render } from "solid-js";

export const rendered = [createSignal, render];
`,
        expectedFragments: [
            'import { createSignal } from "solid-js";',
            'import { render } from "@solidjs/web";'
        ],
        forbiddenFragments: ["createSignal, }", "createSignal,  }"]
    })
]);

const preferClassObjectUnfixed = Object.freeze([
    Object.freeze({
        name: "classList next to an existing class attribute",
        source: `export const View = (props) => {
    return <div class="btn" classList={{ on: props.on }} />;
};
`,
        ruleId: "prefer-class-object"
    })
]);

const preferClassObjectFixes = Object.freeze([
    Object.freeze({
        name: "classList alone becomes class",
        source: `export const View = (props) => {
    return <div classList={{ on: props.on }} />;
};
`,
        expectedFragments: ["<div class={{ on: props.on }} />"],
        forbiddenFragments: ["classList"]
    })
]);

const serverModule = `"use server";

export async function listRows(): Promise<number[]> {
    return [];
}
`;
const plainServerModule = `export const db = { rows: [] };
`;

const serverImportReports = Object.freeze([
    Object.freeze({
        name: "a client file under a nested package.json",
        fileName: "src/routes/nested/page.tsx",
        files: {
            "src/routes/nested/package.json": '{ "name": "nested" }\n',
            "src/server/db.ts": plainServerModule
        },
        code: `import { db } from "~/server/db";

export const View = () => <p>{db.rows.length}</p>;
`
    }),
    Object.freeze({
        name: "a no-substitution template literal in import()",
        fileName: "src/lib/template.ts",
        files: { "src/server/db.ts": plainServerModule },
        code: "export const load = () => import(`~/server/db`);\n"
    }),
    Object.freeze({
        name: "require() with a string",
        fileName: "src/lib/required.ts",
        files: { "src/server/db.ts": plainServerModule },
        code: `export const db = require("~/server/db");\n`
    }),
    Object.freeze({
        name: "require() with a template literal",
        fileName: "src/lib/required_template.ts",
        files: { "src/server/db.ts": plainServerModule },
        code: "export const db = require(`../server/db`);\n"
    }),
    Object.freeze({
        name: "a member access on the string, which is not a directive",
        fileName: "src/routes/member.tsx",
        files: {
            "src/server/member.ts": `"use server".length;\n\nexport const x = 1;\n`
        },
        code: `import { x } from "~/server/member";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "a parenthesized string, which is not a directive",
        fileName: "src/routes/paren.tsx",
        files: {
            "src/server/paren.ts": `("use server");\n\nexport const x = 1;\n`
        },
        code: `import { x } from "~/server/paren";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "an escaped directive, which is not the directive",
        fileName: "src/routes/escaped.tsx",
        files: {
            "src/server/escaped.ts": String.raw`"use\x20server";

export const x = 1;
`
        },
        code: `import { x } from "~/server/escaped";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "a use server that follows a statement after a use strict",
        fileName: "src/routes/after.tsx",
        files: {
            "src/server/after.ts": `"use strict";\nexport const x = 1;\n"use server";\n`
        },
        code: `import { x } from "~/server/after";

export const View = () => <p>{x}</p>;
`
    })
]);

// The outer folder holds `src/server` (the plain module of the other cases);
// the fixture lives in a folder inside it.
const outerServerImport = `import { db } from "../../../src/server/db";

export const View = () => <p>{db.rows.length}</p>;
`;

const serverImportBoundaryReports = Object.freeze([
    Object.freeze({
        name: "an outer src/server when no repository or workspace ends the walk",
        fileName: "inner_plain/src/routes/page.tsx",
        files: { "src/server/db.ts": plainServerModule },
        code: outerServerImport
    })
]);

const serverImportBoundarySilent = Object.freeze([
    Object.freeze({
        name: "an outer src/server behind a .git folder",
        fileName: "inner_git/src/routes/page.tsx",
        files: {
            "inner_git/.git/HEAD": "ref: refs/heads/main\n",
            "src/server/db.ts": plainServerModule
        },
        code: outerServerImport
    }),
    Object.freeze({
        name: "an outer src/server behind a workspace root",
        fileName: "inner_ws/src/routes/page.tsx",
        files: {
            "inner_ws/package.json": '{ "workspaces": ["packages/*"] }\n',
            "src/server/db.ts": plainServerModule
        },
        code: outerServerImport
    })
]);

const serverImportSilent = Object.freeze([
    Object.freeze({
        name: "a directive followed by a line that starts with an identifier beginning with in",
        fileName: "src/routes/in_progress.tsx",
        files: {
            "src/server/in_progress.ts": `"use server"\nin_progress()\nexport const x = 1\n`
        },
        code: `import { x } from "~/server/in_progress";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "a directive after Unicode space characters",
        fileName: "src/routes/unicode_space.tsx",
        files: {
            "src/server/unicode_space.ts": `${String.fromCodePoint(0x3000, 0xa0)}"use server";\n\nexport const x = 1;\n`
        },
        code: `import { x } from "~/server/unicode_space";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "a use server module behind a use strict directive",
        fileName: "src/routes/strict.tsx",
        files: {
            "src/server/strict.ts": `"use strict"; "use server";\n\nexport const x = 1;\n`
        },
        code: `import { x } from "~/server/strict";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "a use server directive without a semicolon",
        fileName: "src/routes/asi.tsx",
        files: {
            "src/server/asi.ts": `"use strict"\n"use server"\nexport const x = 1\n`
        },
        code: `import { x } from "~/server/asi";

export const View = () => <p>{x}</p>;
`
    }),
    Object.freeze({
        name: "a use server module required from client code",
        fileName: "src/lib/required_ok.ts",
        files: { "src/server/rows.ts": serverModule },
        code: `export const rows = require("~/server/rows");\n`
    }),
    Object.freeze({
        name: "a require of a package",
        fileName: "src/lib/required_package.ts",
        code: `export const solid = require("solid-js");\n`
    })
]);

const view = (jsx) => `export const View = (props) => {
    return ${jsx};
};
`;

// Markup that the HTML parser rebuilds: the rendered DOM is not the JSX.
const nestingReports = Object.freeze(
    [
        ["a div in a paragraph", "<p><div /></p>"],
        ["a paragraph in a paragraph", "<p><p /></p>"],
        ["a link in a link", `<a href="/a"><a href="/b" /></a>`],
        ["a button in a button", "<button><button /></button>"],
        ["a form in a form", "<form><form /></form>"],
        ["a heading in a heading", "<h1><h2 /></h1>"],
        ["a list item in a list item", "<ul><li><li /></li></ul>"],
        ["a row without a row group", "<table><tr><td /></tr></table>"],
        ["a cell outside a row", "<div><td /></div>"],
        ["a div in a table", "<table><div /></table>"],
        ["a div in a select", "<select><span /></select>"],
        ["a paragraph in an svg", "<svg><p /></svg>"],
        [
            "a div in a column group",
            "<table><colgroup><div /></colgroup></table>"
        ],
        ["a figcaption in a paragraph", "<p><figcaption /></p>"],
        ["an input without a type in a table", "<table><input /></table>"],
        ["a text input in a table", `<table><input type="text" /></table>`],
        [
            "a hidden input in a column group, which the parser moves out",
            `<table><colgroup><input type="hidden" /></colgroup></table>`
        ]
    ].map(([name, jsx]) =>
        Object.freeze({
            name,
            code: view(jsx),
            message: "Invalid HTML nesting"
        })
    )
);

const nestingInsertedReports = Object.freeze([
    Object.freeze({
        name: "a div in a paragraph behind a condition",
        code: view("<p>{props.on && <div />}</p>"),
        message: "hydration won't match"
    }),
    Object.freeze({
        name: "a div in a paragraph through a conditional expression",
        code: view("<p>{props.on ? <div /> : <span />}</p>"),
        message: "hydration won't match"
    })
]);

const nestingSilent = Object.freeze(
    [
        ["a div in a div", "<div><p /></div>"],
        ["a span in a paragraph", "<p><span /></p>"],
        ["a list item in a list", "<ul><li /></ul>"],
        [
            "a full table",
            "<table><thead><tr><th /></tr></thead><tbody><tr><td /></tr></tbody></table>"
        ],
        ["a hidden input in a table", `<table><input type="hidden" /></table>`],
        [
            "a hidden input in a table, written as an expression",
            `<table><input type={"hidden"} /></table>`
        ],
        [
            "a hidden input in a table body",
            `<table><tbody><input type="hidden" /></tbody></table>`
        ],
        [
            "a hidden input in a table row",
            `<table><tbody><tr><input type="hidden" /></tr></tbody></table>`
        ],
        ["a script in a table", "<table><script /></table>"],
        ["a definition in a list, which the parser keeps", "<ul><dd /></ul>"],
        ["svg content", "<svg><g><path /></g></svg>"],
        ["a row in a template", "<template><tr><td /></tr></template>"],
        ["a column in a template", "<template><col /></template>"],
        ["a table section in a template", "<template><thead /></template>"],
        ["a cell in a template", "<template><td /></template>"],
        [
            "a div in a foreignObject",
            "<svg><foreignObject><div /></foreignObject></svg>"
        ],
        [
            "children of a component",
            "<p><Show when={props.on}><b /></Show></p>"
        ],
        [
            "elements made in a callback",
            "<p>{props.items.map(() => <div />)}</p>"
        ],
        ["a component in a paragraph", "<p><Card /></p>"]
    ].map(([name, jsx]) => Object.freeze({ name, code: view(jsx) }))
);

// The cases of eslint-plugin-solid 0.20 for `validate-jsx-nesting`. The rule
// reports the pairs that parse5 does not keep as written, so the silent list
// holds the markup the spec forbids but the parser keeps.
const NESTING_MESSAGES = Object.freeze({
    plain: (parent, child) =>
        `Invalid HTML nesting: \`<${child}>\` cannot be a child of \`<${parent}>\`. The HTML parser restructures this, so the rendered DOM won't match this markup.`,
    inserted: (parent, child) =>
        `Invalid HTML nesting: \`<${child}>\` cannot be a child of \`<${parent}>\`. The client inserts it as written, but the HTML parser restructures it in server-rendered HTML, so hydration won't match this markup.`
});
// `reports` are the messages of the rule, one per report and in source order:
// the case fails on a missing, an extra or a wrong kind of report.
const nestingCase = (jsx, ...errors) =>
    Object.freeze({
        name: jsx,
        code: view(jsx),
        reports: errors.map(([kind, parent, child]) =>
            NESTING_MESSAGES[kind](parent, child)
        )
    });

const nestingUpstreamSilent = Object.freeze(
    [
        `<div><p>Hello world!</p></div>`,
        `<p><span>Hello world!</span></p>`,
        `<p>Hello <em>world</em>!</p>`,
        `<p>one<br />two</p>`,
        `<table><tbody><tr><td>1</td></tr></tbody></table>`,
        `<ul><li>one</li><li>two</li></ul>`,
        `<select><option>one</option></select>`,
        // the parser keeps these, so they are not this rule's business even though
        // the spec's content model disallows them
        `<h1><div>Hello world!</div></h1>`,
        `<div><figcaption>Hello world!</figcaption></div>`,
        `<ul><figcaption>Hello world!</figcaption></ul>`,
        `<div><summary>Hello world!</summary></div>`,
        `<html><body><figcaption>Caption</figcaption></body></html>`,
        `<body><dd>Definition</dd></body>`,
        `<body><dt>Term</dt></body>`,
        `<body><summary>More</summary></body>`,
        `<body><area shape="rect" coords="0,0,1,1" href="/" /></body>`,
        `<html><head><basefont /></head></html>`,
        `<table><script>{"1"}</script></table>`,
        `<table><style>{"td{}"}</style></table>`,
        `<table><tbody><tr><td><figcaption>Caption</figcaption></td></tr></tbody></table>`,
        `<table><tbody><tr><th><dd>Definition</dd></th></tr></tbody></table>`,
        `<table><tbody><tr><template /></tr></tbody></table>`,
        `<table><tbody><script>{"1"}</script></tbody></table>`,
        `<table><thead><template /></thead></table>`,
        `<table><tfoot><template /></tfoot></table>`,
        `<table><colgroup><template /></colgroup></table>`,
        `<table><caption><figcaption>Caption</figcaption></caption></table>`,
        // MathML and SVG are not HTML content models
        `<math><mi>x</mi><mo>=</mo><mn>1</mn></math>`,
        `<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>`,
        `<math><semantics><mi>x</mi></semantics></math>`,
        `<svg><a href="/"><path d="" /></a></svg>`,
        `<svg><tr /></svg>`,
        // the parser keeps these inside <svg>, even though it rewrites them in HTML
        `<svg><a href="/one"><a href="/two" /></a></svg>`,
        `<svg><title><b>Hello world!</b></title></svg>`,
        `<svg><font><a href="/one"><a href="/two" /></a></font></svg>`,
        `<math><annotation-xml><a href="/one"><a href="/two" /></a></annotation-xml></math>`,
        // void tags have no end tag; `</br>` would be parsed as a second <br>
        `<svg><title>one<br />two</title></svg>`,
        `<optgroup label="Group"><br /></optgroup>`,
        // outside <svg> the parser lowercases tags like foreignObject, which is still the same tag
        `<foreignObject><figcaption>Caption</figcaption></foreignObject>`,
        `<math><clipPath /></math>`,
        // <title> hands its children back to HTML only in SVG, and <mi> only in MathML
        `<math><title><a href="/one"><a href="/two" /></a></title></math>`,
        `<svg><mi><a href="/one"><a href="/two" /></a></mi></svg>`,
        // nested in foreign content, <svg> and <math> are plain elements of the namespace around them
        `<svg><math><mi><a href="/one"><a href="/two" /></a></mi></math></svg>`,
        `<svg><g><math><title><b>Hello world!</b></title></math></g></svg>`,
        `<math><svg><title><a href="/one"><a href="/two" /></a></title></svg></math>`,
        // behind an expression they are the root of a separate template and start their own namespace
        `<math>{ok && <svg><title><b>Hello world!</b></title></svg>}</math>`,
        // <mglyph> and <malignmark> right inside <mi> and the like stay MathML, children included
        `<math><mi><mglyph><caption /></mglyph></mi></math>`,
        `<math><mtext><malignmark><caption /></malignmark></mtext></math>`,
        // content-model restrictions the parser doesn't enforce by moving anything
        `<figure><a href="/x"><img src="a.png" /><figcaption>Caption</figcaption></a></figure>`,
        `<figure><div><figcaption>Caption</figcaption></div></figure>`,
        `<details><div><summary>More</summary></div></details>`,
        `<div><area shape="rect" coords="0,0,1,1" href="/" /></div>`,
        `<dl><div><dt>term</dt><dd>definition</dd></div></dl>`,
        `<my-figure><img src="a.png" /><figcaption>Caption</figcaption></my-figure>`,
        `<p><my-widget>Hello world!</my-widget></p>`,
        // headings close the current node, never an ancestor
        `<h1><span><h2>Hello world!</h2></span></h1>`,
        `<math><mi>x</mi></math>`,
        `<math><msqrt><mn>2</mn></msqrt></math>`,
        `<svg><text>Hello world!</text></svg>`,
        `<svg><foreignObject><div>Hello world!</div></foreignObject></svg>`,
        // custom elements can define any content model
        `<my-widget><div>Hello world!</div></my-widget>`,
        // components can render anything, including a wrapper that makes this legal
        `<p><Foo /></p>`,
        `<Foo><hr /></Foo>`,
        `<p><Foo.Bar /></p>`,
        `<Dynamic component={tag}><hr /></Dynamic>`,
        // control flow hides what actually wraps the child at runtime
        `<p><Show when={condition}><hr /></Show></p>`,
        `<table>{items.map((item) => <div>{item}</div>)}</table>`,
        // a prop that isn't `children` is data, not a child position
        `<p fallback={<hr />}>Hello world!</p>`,
        // sibling, not nested
        `<><p>Hello world!</p><hr /></>`,
        // no JSX parent at all
        `<hr />`
    ].map((jsx) => Object.freeze({ name: jsx, code: view(jsx) }))
);

const nestingUpstreamReports = Object.freeze([
    nestingCase(`<head><div /></head>`, ["plain", "head", "div"]),
    nestingCase(`<body><tr /></body>`, ["plain", "body", "tr"]),
    nestingCase(`<p><div>Hello world!</div></p>`, ["plain", "p", "div"]),
    nestingCase(`<p><hr /></p>`, ["plain", "p", "hr"]),
    nestingCase(`<p>Hello <p>world</p>!</p>`, ["plain", "p", "p"]),
    nestingCase(`<table><div>Hello world!</div></table>`, [
        "plain",
        "table",
        "div"
    ]),
    nestingCase(`<tr><div>Hello world!</div></tr>`, ["plain", "tr", "div"]),
    nestingCase(`<table><tbody><tr><td><tr /></td></tr></tbody></table>`, [
        "plain",
        "td",
        "tr"
    ]),
    nestingCase(`<a href="/one"><a href="/two">Hello world!</a></a>`, [
        "plain",
        "a",
        "a"
    ]),
    nestingCase(`<button><button>Hello world!</button></button>`, [
        "plain",
        "button",
        "button"
    ]),
    nestingCase(`<form><form>Hello world!</form></form>`, [
        "plain",
        "form",
        "form"
    ]),
    nestingCase(`<svg><div>Hello world!</div></svg>`, ["plain", "svg", "div"]),
    // integration points hand their children back to the HTML parser
    nestingCase(
        `<svg><foreignObject><p><div>Hello world!</div></p></foreignObject></svg>`,
        ["plain", "p", "div"]
    ),
    nestingCase(
        `<math><mi><a href="/one"><a href="/two">x</a></a></mi></math>`,
        ["plain", "a", "a"]
    ),
    // the parser lowercases tag and attribute names first
    nestingCase(
        `<svg><foreignobject><a href="/one"><a href="/two" /></a></foreignobject></svg>`,
        ["plain", "a", "a"]
    ),
    nestingCase(
        `<math><annotation-xml Encoding="text/html"><a href="/one"><a href="/two" /></a></annotation-xml></math>`,
        ["plain", "a", "a"]
    ),
    // one level down, <mglyph> is HTML like the rest
    nestingCase(
        `<math><mi><span><mglyph><caption /></mglyph></span></mi></math>`,
        ["plain", "mglyph", "caption"]
    ),
    // so do HTML tags that make the parser leave foreign content
    nestingCase(
        `<svg><g><p><a href="/one"><a href="/two" /></a></p></g></svg>`,
        ["plain", "a", "a"]
    ),
    nestingCase(
        `<svg><font color="red"><a href="/one"><a href="/two" /></a></font></svg>`,
        ["plain", "a", "a"]
    ),
    nestingCase(
        `<math><annotation-xml encoding="text/html"><a href="/one"><a href="/two" /></a></annotation-xml></math>`,
        ["plain", "a", "a"]
    ),
    // below a nested <svg> or <math>, integration points are those of the namespace around it
    nestingCase(`<math><svg><title><b>Hello world!</b></title></svg></math>`, [
        "plain",
        "title",
        "b"
    ]),
    nestingCase(
        `<svg><math><title><a href="/one"><a href="/two" /></a></title></math></svg>`,
        ["plain", "a", "a"]
    ),
    nestingCase(
        `<svg>{ok && <math><mi><a href="/one"><a href="/two" /></a></mi></math>}</svg>`,
        ["plain", "a", "a"]
    ),
    // only <svg> right inside <annotation-xml> starts SVG within MathML
    nestingCase(
        `<math><annotation-xml><svg><title><a href="/one"><a href="/two" /></a></title></svg></annotation-xml></math>`,
        ["plain", "a", "a"]
    ),
    nestingCase(`<table><thead><th>1</th></thead></table>`, [
        "plain",
        "thead",
        "th"
    ]),
    nestingCase(`<table><col /></table>`, ["plain", "table", "col"]),
    nestingCase(`<div><tr><td>1</td></tr></div>`, ["plain", "div", "tr"]),
    nestingCase(`<ul><li>one<li>two</li></li></ul>`, ["plain", "li", "li"]),
    nestingCase(`<h1><h2>Hello world!</h2></h1>`, ["plain", "h1", "h2"]),
    nestingCase(`<textarea><div>Hello world!</div></textarea>`, [
        "plain",
        "textarea",
        "div"
    ]),
    // a custom element doesn't make table markup legal
    nestingCase(`<x-row><td>1</td></x-row>`, ["plain", "x-row", "td"]),
    // these all compile to the same insert() into the same parent, which only
    // server-rendered HTML sends back through the parser
    nestingCase(`<p>{<hr />}</p>`, ["inserted", "p", "hr"]),
    nestingCase(`<p>{condition && <hr />}</p>`, ["inserted", "p", "hr"]),
    nestingCase(
        `<p>{condition ? <hr /> : <div />}</p>`,
        ["inserted", "p", "hr"],
        ["inserted", "p", "div"]
    ),
    nestingCase(`<p>{[<hr />]}</p>`, ["inserted", "p", "hr"]),
    nestingCase(`<p children={<hr />} />`, ["inserted", "p", "hr"]),
    // each level is reported on its own
    nestingCase(
        `<p><div><p><hr /></p></div></p>`,
        ["plain", "p", "div"],
        ["plain", "p", "hr"]
    ),
    nestingCase(
        `<p><div /><div /></p>`,
        ["plain", "p", "div"],
        ["plain", "p", "div"]
    )
]);

export {
    importsFixes,
    nestingInsertedReports,
    nestingReports,
    nestingSilent,
    nestingUpstreamReports,
    nestingUpstreamSilent,
    noDestructureFixes,
    noDestructureUnfixed,
    preferArrowFixes,
    preferArrowUnfixed,
    preferClassObjectFixes,
    preferClassObjectUnfixed,
    scriptUrlReports,
    scriptUrlSilent,
    serverImportBoundaryReports,
    serverImportBoundarySilent,
    serverImportReports,
    serverImportSilent
};
