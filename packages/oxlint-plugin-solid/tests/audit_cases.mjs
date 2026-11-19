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
`,
    }),
    Object.freeze({
        name: "a newline in front of the scheme",
        code: String.raw`export const View = () => <a href={"\njavascript:alert(1)"}>x</a>;
`,
    }),
    Object.freeze({
        name: "a control character in front of the scheme",
        code: String.raw`export const View = () => <a href={"\u0001javascript:alert(1)"}>x</a>;
`,
    }),
    Object.freeze({
        name: "spaces in front of an upper-case scheme",
        code: String.raw`export const View = () => <a href={"  JavaScript:alert(1)"}>x</a>;
`,
    }),
]);

const scriptUrlSilent = Object.freeze([
    Object.freeze({
        name: "javascript: that does not start the value",
        code: `export const View = () => <a href="ABCjavascript:void(0)">x</a>;
`,
    }),
    Object.freeze({
        name: "an https URL",
        code: `export const View = () => <a href="https://example.com">x</a>;
`,
    }),
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
            'import type { Component } from "solid-js";',
        ],
        forbiddenFragments: ["export default const", "function Page"],
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
            "export const Second: ParentComponent<Props> = (props) => {",
        ],
        forbiddenFragments: ["function First", "function Second"],
        singleFragments: ['from "solid-js"'],
        stable: true,
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
        importBefore: "export const make",
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
            "export const Leaf: Component = () => {",
        ],
    }),
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
        ruleId: "prefer-arrow-components",
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
        ruleId: "prefer-arrow-components",
    }),
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
        forbiddenFragments: ["{ props.title", "= ({ title"],
    }),
    Object.freeze({
        name: "a shorthand property next to a default",
        source: `declare function use(options: object): string;

export const Panel = ({ title = "x" }) => {
    return <div>{use({ title })}</div>;
};
`,
        expectedFragments: ["{ title: props.title }", "merge({ title:"],
    }),
    Object.freeze({
        name: "an inner component does not shadow the props of the outer one",
        source: `export const Outer = (props) => {
    const Inner = ({ label }) => <b>{props.id}{label}</b>;

    return <Inner label="x" />;
};
`,
        expectedFragments: ["(props2) =>", "props.id", "props2.label"],
        forbiddenFragments: ["props.label", "({ label"],
    }),
    Object.freeze({
        name: "an inner component picks a name that its body does not read from outside",
        source: `const props = { id: 1 };

export const Panel = ({ label }) => {
    return <b>{props.id}{label}</b>;
};
`,
        expectedFragments: ["(props2) =>", "props.id", "props2.label"],
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
            "{(props) =>",
        ],
        forbiddenFragments: ["{props.title}", "props.items"],
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
            "const props = { x: item }",
        ],
        forbiddenFragments: ["{props.title}", "props.items"],
    }),
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
        ruleId: "no-destructure",
    }),
    Object.freeze({
        name: "a computed key that is not a literal",
        source: `const key = "a";

export const Row = ({ [key]: label, ...rest }) => {
    return <p {...rest}>{label}</p>;
};
`,
        ruleId: "no-destructure",
    }),
    Object.freeze({
        name: "a write to a destructured name",
        source: `export const Counter = ({ count }) => {
    count += 1;

    return <p>{count}</p>;
};
`,
        ruleId: "no-destructure",
    }),
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
        forbiddenFragments: ['import type { JSX } from "solid-js"'],
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
            'import { render } from "@solidjs/web";',
        ],
        forbiddenFragments: ["JSX, render", "render, JSX"],
        stable: true,
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
            'import { createSignal } from "solid-js";',
        ],
        forbiddenFragments: ["type JSX }", "type JSX,"],
        stable: true,
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
            'import { render as draw } from "@solidjs/web";',
        ],
        stable: true,
    }),
    Object.freeze({
        name: "the last specifier of an import leaves no dangling comma",
        source: `import { createSignal, render } from "solid-js";

export const rendered = [createSignal, render];
`,
        expectedFragments: [
            'import { createSignal } from "solid-js";',
            'import { render } from "@solidjs/web";',
        ],
        forbiddenFragments: ["createSignal, }", "createSignal,  }"],
    }),
]);

const preferClassObjectUnfixed = Object.freeze([
    Object.freeze({
        name: "classList next to an existing class attribute",
        source: `export const View = (props) => {
    return <div class="btn" classList={{ on: props.on }} />;
};
`,
        ruleId: "prefer-class-object",
    }),
]);

const preferClassObjectFixes = Object.freeze([
    Object.freeze({
        name: "classList alone becomes class",
        source: `export const View = (props) => {
    return <div classList={{ on: props.on }} />;
};
`,
        expectedFragments: ["<div class={{ on: props.on }} />"],
        forbiddenFragments: ["classList"],
    }),
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
            "src/server/db.ts": plainServerModule,
        },
        code: `import { db } from "~/server/db";

export const View = () => <p>{db.rows.length}</p>;
`,
    }),
    Object.freeze({
        name: "a no-substitution template literal in import()",
        fileName: "src/lib/template.ts",
        files: { "src/server/db.ts": plainServerModule },
        code: "export const load = () => import(`~/server/db`);\n",
    }),
    Object.freeze({
        name: "require() with a string",
        fileName: "src/lib/required.ts",
        files: { "src/server/db.ts": plainServerModule },
        code: `export const db = require("~/server/db");\n`,
    }),
    Object.freeze({
        name: "require() with a template literal",
        fileName: "src/lib/required_template.ts",
        files: { "src/server/db.ts": plainServerModule },
        code: "export const db = require(`../server/db`);\n",
    }),
    Object.freeze({
        name: "a member access on the string, which is not a directive",
        fileName: "src/routes/member.tsx",
        files: {
            "src/server/member.ts": `"use server".length;\n\nexport const x = 1;\n`,
        },
        code: `import { x } from "~/server/member";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "a parenthesized string, which is not a directive",
        fileName: "src/routes/paren.tsx",
        files: {
            "src/server/paren.ts": `("use server");\n\nexport const x = 1;\n`,
        },
        code: `import { x } from "~/server/paren";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "an escaped directive, which is not the directive",
        fileName: "src/routes/escaped.tsx",
        files: {
            "src/server/escaped.ts": String.raw`"use\x20server";

export const x = 1;
`,
        },
        code: `import { x } from "~/server/escaped";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "a use server that follows a statement after a use strict",
        fileName: "src/routes/after.tsx",
        files: {
            "src/server/after.ts": `"use strict";\nexport const x = 1;\n"use server";\n`,
        },
        code: `import { x } from "~/server/after";

export const View = () => <p>{x}</p>;
`,
    }),
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
        code: outerServerImport,
    }),
]);

const serverImportBoundarySilent = Object.freeze([
    Object.freeze({
        name: "an outer src/server behind a .git folder",
        fileName: "inner_git/src/routes/page.tsx",
        files: {
            "inner_git/.git/HEAD": "ref: refs/heads/main\n",
            "src/server/db.ts": plainServerModule,
        },
        code: outerServerImport,
    }),
    Object.freeze({
        name: "an outer src/server behind a workspace root",
        fileName: "inner_ws/src/routes/page.tsx",
        files: {
            "inner_ws/package.json": '{ "workspaces": ["packages/*"] }\n',
            "src/server/db.ts": plainServerModule,
        },
        code: outerServerImport,
    }),
]);

const serverImportSilent = Object.freeze([
    Object.freeze({
        name: "a directive followed by a line that starts with an identifier beginning with in",
        fileName: "src/routes/in_progress.tsx",
        files: {
            "src/server/in_progress.ts": `"use server"\nin_progress()\nexport const x = 1\n`,
        },
        code: `import { x } from "~/server/in_progress";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "a directive after Unicode space characters",
        fileName: "src/routes/unicode_space.tsx",
        files: {
            "src/server/unicode_space.ts": `${String.fromCodePoint(0x3000, 0xa0)}"use server";\n\nexport const x = 1;\n`,
        },
        code: `import { x } from "~/server/unicode_space";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "a use server module behind a use strict directive",
        fileName: "src/routes/strict.tsx",
        files: {
            "src/server/strict.ts": `"use strict"; "use server";\n\nexport const x = 1;\n`,
        },
        code: `import { x } from "~/server/strict";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "a use server directive without a semicolon",
        fileName: "src/routes/asi.tsx",
        files: {
            "src/server/asi.ts": `"use strict"\n"use server"\nexport const x = 1\n`,
        },
        code: `import { x } from "~/server/asi";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "a use server module required from client code",
        fileName: "src/lib/required_ok.ts",
        files: { "src/server/rows.ts": serverModule },
        code: `export const rows = require("~/server/rows");\n`,
    }),
    Object.freeze({
        name: "a require of a package",
        fileName: "src/lib/required_package.ts",
        code: `export const solid = require("solid-js");\n`,
    }),
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
            "<table><colgroup><div /></colgroup></table>",
        ],
        ["a figcaption in a paragraph", "<p><figcaption /></p>"],
    ].map(([name, jsx]) =>
        Object.freeze({
            name,
            code: view(jsx),
            message: "Invalid HTML nesting",
        }),
    ),
);

const nestingInsertedReports = Object.freeze([
    Object.freeze({
        name: "a div in a paragraph behind a condition",
        code: view("<p>{props.on && <div />}</p>"),
        message: "hydration won't match",
    }),
    Object.freeze({
        name: "a div in a paragraph through a conditional expression",
        code: view("<p>{props.on ? <div /> : <span />}</p>"),
        message: "hydration won't match",
    }),
]);

const nestingSilent = Object.freeze(
    [
        ["a div in a div", "<div><p /></div>"],
        ["a span in a paragraph", "<p><span /></p>"],
        ["a list item in a list", "<ul><li /></ul>"],
        [
            "a full table",
            "<table><thead><tr><th /></tr></thead><tbody><tr><td /></tr></tbody></table>",
        ],
        ["a hidden input in a table", `<table><input type="hidden" /></table>`],
        ["a script in a table", "<table><script /></table>"],
        ["a definition in a list, which the parser keeps", "<ul><dd /></ul>"],
        ["svg content", "<svg><g><path /></g></svg>"],
        ["a row in a template", "<template><tr><td /></tr></template>"],
        ["a column in a template", "<template><col /></template>"],
        ["a table section in a template", "<template><thead /></template>"],
        ["a cell in a template", "<template><td /></template>"],
        [
            "a div in a foreignObject",
            "<svg><foreignObject><div /></foreignObject></svg>",
        ],
        [
            "children of a component",
            "<p><Show when={props.on}><b /></Show></p>",
        ],
        [
            "elements made in a callback",
            "<p>{props.items.map(() => <div />)}</p>",
        ],
        ["a component in a paragraph", "<p><Card /></p>"],
    ].map(([name, jsx]) => Object.freeze({ name, code: view(jsx) })),
);

export {
    importsFixes,
    nestingInsertedReports,
    nestingReports,
    nestingSilent,
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
    serverImportSilent,
};
