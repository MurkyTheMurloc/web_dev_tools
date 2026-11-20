// Cases about which `solid-js` / `@solidjs/web` names the plugin knows about,
// and about the import statements its autofixes write.

// `--fix` cases. Each fixture is linted with `--fix`; the result must contain
// every `expectedFragments` entry, none of `forbiddenFragments`, and every
// `singleFragments` entry exactly once.
const importFixCases = Object.freeze([
    Object.freeze({
        expectedFragments: [
            'import { omit } from "solid-js";',
            'const rest = omit(props, "name");'
        ],
        name: "no-destructure imports omit when it takes the rest",
        source: `export const OnlyRest = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { merge, omit } from "solid-js";'],
        name: "no-destructure imports merge and omit for defaults with a rest",
        source: `export const Both = ({ name = "x", ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { merge } from "solid-js";'],
        name: "no-destructure imports merge for defaults",
        source: `export const OnlyDefaults = ({ name = "x" }) => {
    return <div>{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { createSignal, omit } from "solid-js";'],
        name: "no-destructure adds omit to an existing solid-js import",
        source: `import { createSignal } from "solid-js";

export const WithImport = ({ name, ...rest }) => {
    const [count] = createSignal(0);

    return <div {...rest}>{name}{count()}</div>;
};
`
    }),
    Object.freeze({
        singleFragments: ['import { omit } from "solid-js";'],
        name: "no-destructure does not import omit twice",
        source: `import { omit } from "solid-js";

export const AlreadyImported = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['const rest = pick(props, "name");'],
        forbiddenFragments: ["omit("],
        name: "no-destructure calls omit through its local alias",
        source: `import { omit as pick } from "solid-js";

export const Aliased = ({ name, ...rest }) => {
    return <div {...rest}>{name}{String(pick)}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { omit } from "solid-js";'],
        forbiddenFragments: ["import type { Component }, {"],
        name: "no-destructure does not extend a type-only solid-js import",
        source: `import type { Component } from "solid-js";

export const Typed: Component = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            'import { merge } from "lodash";',
            'import { merge as solidMerge } from "solid-js";',
            'const props = solidMerge({ name: "x" }, _props);'
        ],
        forbiddenFragments: ['= merge({ name: "x" }'],
        singleFragments: ['import { merge } from "lodash";'],
        name: "no-destructure imports merge under an alias next to another merge import",
        source: `import { merge } from "lodash";

export const Defaulted = ({ name = "x" }) => {
    return <div>{name}{String(merge)}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            "const omit = 1;",
            'import { omit as solidOmit } from "solid-js";',
            'const rest = solidOmit(props, "name");'
        ],
        forbiddenFragments: ['= omit(props, "name")', "import { omit }"],
        name: "no-destructure imports omit under an alias next to a local omit",
        source: `const omit = 1;

export const OnlyRest = ({ name, ...rest }) => {
    return <div {...rest}>{name}{omit}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            'import { merge as solidMerge2 } from "solid-js";',
            'const props = solidMerge2({ name: "x" }, _props);'
        ],
        forbiddenFragments: ["= solidMerge({", "= merge({"],
        name: "no-destructure picks the next free alias when the first alias is taken too",
        source: `import { merge } from "lodash";

const solidMerge = 1;

export const Defaulted = ({ name = "x" }) => {
    return <div>{name}{String(merge)}{solidMerge}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['const props = merge({ name: "x" }, _props);'],
        forbiddenFragments: ["solidMerge"],
        singleFragments: ['import { merge } from "solid-js";'],
        name: "no-destructure keeps calling merge when it is already imported from solid-js",
        source: `import { merge } from "solid-js";

export const Defaulted = ({ name = "x" }) => {
    return <div>{name}{String(merge)}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            'import { merge, omit } from "solid-js";',
            'const props = merge({ name: "a" }, _props);',
            'const props = merge({ title: "b" }, _props);',
            'const rest = omit(props, "title");'
        ],
        forbiddenFragments: ["= ({ name", "= ({ title"],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure fixes two components in one run with one import",
        source: `export const First = ({ name = "a" }) => {
    return <div>{name}</div>;
};

export const Second = ({ title = "b", ...rest }) => {
    return <div {...rest}>{title}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            'import { createSignal, merge as solidMerge, omit } from "solid-js";',
            'const props = solidMerge({ title: "b" }, _props);',
            'const rest = omit(props, "title");',
            "props.name"
        ],
        forbiddenFragments: ["= ({ name", "= ({ title"],
        singleFragments: ['from "solid-js"', 'import { merge } from "lodash";'],
        name: "no-destructure fixes two components in one run when the first needs no import",
        source: `import { merge } from "lodash";
import { createSignal } from "solid-js";

export const First = ({ name }) => {
    return <div>{name}{String(merge)}{String(createSignal)}</div>;
};

export const Second = ({ title = "b", ...rest }) => {
    return <div {...rest}>{title}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            'import { merge, merge as solidMerge } from "solid-js";',
            'const props = solidMerge({ name: "x" }, _props);'
        ],
        forbiddenFragments: ['= merge({ name: "x" }'],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure does not call a solid-js import that a binding in the component shadows",
        source: `import { merge } from "solid-js";

export const Defaulted = ({ name = "x" }) => {
    const merge = 1;

    return <div>{name}{merge}</div>;
};
`
    }),
    // A fix that is dropped (here by prefer-arrow-components, which rewrites
    // the same function) can leave a call without its import. Further runs
    // must end with valid code and one import of everything that is called.
    Object.freeze({
        expectedFragments: [
            'import { merge, omit, type Component } from "solid-js";',
            "export const First: Component<Props> = (_props) =>"
        ],
        forbiddenFragments: ["= ({ title", "function First", "= ({ name"],
        runs: 2,
        singleFragments: ['from "solid-js"'],
        name: "no-destructure and prefer-arrow-components end with one solid-js import after two runs",
        source: `import type { JSX } from "@solidjs/web";

type Props = {
    readonly name?: string;
};

export function First({ name = "a" }: Props): JSX.Element {
    return <div>{name}</div>;
}

export const Second = ({ title = "b", ...rest }) => {
    return <div {...rest}>{title}</div>;
};
`
    }),
    // What a run leaves when the fix of the first component was dropped: the
    // second component already calls merge and omit, the first still
    // destructures. The next run fixes the first and imports both names.
    Object.freeze({
        expectedFragments: [
            'import { merge, omit } from "solid-js";',
            'const props = merge({ name: "a" }, _props);'
        ],
        forbiddenFragments: ["= ({ name"],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure imports what an earlier run left dangling in another component",
        source: `export const First = ({ name = "a" }) => {
    return <div>{name}</div>;
};

export const Second = (_props) => {
    const props = merge({ title: "b" }, _props);
    const rest = omit(props, "title");

    return <div {...rest}>{props.title}</div>;
};
`
    }),
    // The parameter on its own line, as a formatter lays out a long signature.
    Object.freeze({
        expectedFragments: [
            'import { merge, omit } from "solid-js";',
            'const props = merge({ title: "a" }, _props);',
            'const rest = omit(props, "title");',
            'const props = merge({ name: "b" }, _props);'
        ],
        forbiddenFragments: ["({ title =", "({ name ="],
        singleFragments: ['from "solid-js"'],
        stable: true,
        name: "no-destructure fixes a parameter on its own line next to a second component",
        source: `export const First =
    ({ title = "a", ...rest }) => (
        <div {...rest}>{title}</div>
    );

export const Second = ({ name = "b" }) => {
    return <div>{name}</div>;
};
`
    }),
    // A destructured prop called merge goes away with the fix, so merge is
    // free for the call.
    Object.freeze({
        expectedFragments: [
            'import { merge } from "solid-js";',
            'const props = merge({ merge: 1, name: "x" }, _props);'
        ],
        forbiddenFragments: ["solidMerge"],
        name: "no-destructure calls merge when the only merge is a prop the fix removes",
        source: `export const Panel = ({ merge = 1, name = "x" }) => {
    return <div>{merge}{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['const props = solidMerge({ name: "x" }, _props);'],
        forbiddenFragments: ["solidMerge2", "= merge({"],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure reuses an existing alias import when the plain one is shadowed",
        source: `import { merge, merge as solidMerge } from "solid-js";

export const Defaulted = ({ name = "x" }) => {
    const merge = 1;

    return <div>{name}{merge}{String(solidMerge)}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { merge } from "solid-js";'],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure adds the import for a merge call that has none",
        source: `export const Panel = (props) => {
    const merged = merge({ a: 1 }, props);

    return <div>{merged.a}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { merge as solidMerge2 } from "solid-js";'],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure imports a dangling alias under its own name",
        source: `export const Panel = (props) => {
    const merged = solidMerge2({ a: 1 }, props);

    return <div>{merged.a}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: [
            'import { createSignal, merge, omit } from "solid-js";'
        ],
        singleFragments: ['from "solid-js"'],
        name: "no-destructure adds the names of dangling calls to the existing solid-js import",
        source: `import { createSignal } from "solid-js";

export const Panel = (props) => {
    const [count] = createSignal(0);
    const merged = merge({ a: 1 }, props);
    const rest = omit(merged, "a");

    return <div {...rest}>{count()}</div>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { Show } from "solid-js";'],
        forbiddenFragments: ["* as Solid, {"],
        name: "jsx-no-undef adds a named import next to a namespace import",
        source: `import * as Solid from "solid-js";

export const View = () => {
    return <Show when={Solid.DEV}>Visible</Show>;
};
`
    }),
    Object.freeze({
        expectedFragments: ['import { render } from "@solidjs/web";'],
        forbiddenFragments: ["* as Web, {"],
        name: "imports moves a name next to a namespace import",
        source: `import * as Web from "@solidjs/web";
import { render } from "solid-js";

export const exported = [Web, render];
`
    })
]);

// `merge`/`omit` calls that no-destructure must not report: some binding
// answers to the name.
const noDestructureSilentCases = Object.freeze([
    Object.freeze({
        name: "a merge imported from lodash",
        source: `import { merge } from "lodash";

export const Panel = (props) => {
    return <div>{String(merge({ a: 1 }, props))}</div>;
};
`
    }),
    Object.freeze({
        name: "a merge call with two identifiers, which this rule never writes",
        source: `export const Panel = (props: { a: object; b: object }) => {
    return <div>{String(merge(props.a, props.b))}</div>;
};

export const joined = (a: object, b: object) => merge(a, b);
`
    }),
    Object.freeze({
        name: "an omit call with a key that is not a literal",
        source: `export const Panel = (props: { key: string }) => {
    const key = props.key;

    return <div>{String(omit(props, key))}</div>;
};
`
    }),
    Object.freeze({
        name: "a merge call in a module with no JSX and no solid-js import",
        source: `export const run = (x: object) => merge({}, x);
`
    }),
    Object.freeze({
        name: "a JSX element called merge",
        source: `export const Panel = () => {
    return <merge>text</merge>;
};
`
    }),
    Object.freeze({
        name: "a merge method call and an object key",
        source: `const tools = { merge: (a: number) => a, omit: (a: number) => a };

export const Panel = () => {
    return <div>{tools.merge(1)}{tools.omit(2)}</div>;
};
`
    }),
    Object.freeze({
        name: "class members called merge and omit",
        source: `class Tools {
    merge() {
        return 1;
    }

    omit() {
        return 2;
    }
}

export const Panel = () => {
    return <div>{new Tools().merge()}{new Tools().omit()}</div>;
};
`
    }),
    Object.freeze({
        name: "a function parameter called merge",
        source: `const apply = (merge: (a: number) => number) => merge(1);

export const Panel = () => {
    return <div>{apply((a) => a)}</div>;
};
`
    }),
    Object.freeze({
        name: "a type position and a bare read that are not calls",
        source: `type Joiner = typeof merge;

export const Panel = (props: { join: Joiner }) => {
    return <div>{String(props.join)}{String(typeof omit)}</div>;
};
`
    }),
    Object.freeze({
        name: "an omit declared in the file",
        source: `const omit = (value: object) => value;

export const Panel = (props: object) => {
    return <div>{String(omit(props))}</div>;
};
`
    })
]);

// Names that `solid-js` 2.0.2 exports and that must be imported from it, not
// from `@solidjs/web`.
const importsSolidJsNames = Object.freeze([
    "createDeferred",
    "createTrackedEffect",
    "from",
    "onFlush",
    "repeat"
]);

// Imports that the rule must leave alone: not exported by the package the
// rule used to point at, or exported by more than one package.
const importsSilentCases = Object.freeze([
    Object.freeze({
        name: "the boundary primitives, which solid-js 2.0.2 marks @internal",
        source: `import {
    createErrorBoundary,
    createLoadingBoundary,
    createRevealOrder,
} from "@solidjs/web";

export const boundaries = [
    createErrorBoundary,
    createLoadingBoundary,
    createRevealOrder,
];
`
    }),
    Object.freeze({
        name: "createOwner, which solid-js 2.0.2 marks @internal and strips from its types",
        source: `import { createOwner } from "@solidjs/web";

export const owner = createOwner;
`
    }),
    Object.freeze({
        name: "storePath, which solid-js no longer exports",
        source: `import { storePath } from "@solidjs/web";

export const path = storePath;
`
    }),
    Object.freeze({
        name: "ClassValue, which only exists as JSX.ClassValue",
        source: `import type { ClassValue } from "solid-js";

export type Classes = ClassValue;
`
    }),
    Object.freeze({
        name: "ValidComponent from @solidjs/web, which declares its own",
        source: `import type { ValidComponent } from "@solidjs/web";

export type Tag = ValidComponent;
`
    }),
    Object.freeze({
        name: "dynamicComponent from @solidjs/web, which re-exports it",
        source: `import { dynamicComponent } from "@solidjs/web";

export const tag = dynamicComponent;
`
    })
]);

export {
    importFixCases,
    importsSilentCases,
    importsSolidJsNames,
    noDestructureSilentCases
};
