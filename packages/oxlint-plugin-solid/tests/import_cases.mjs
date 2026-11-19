// Cases about which `solid-js` / `@solidjs/web` names the plugin knows about,
// and about the import statements its autofixes write.

// `--fix` cases. Each fixture is linted with `--fix`; the result must contain
// every `expectedFragments` entry, none of `forbiddenFragments`, and every
// `singleFragments` entry exactly once.
const importFixCases = Object.freeze([
    Object.freeze({
        expectedFragments: [
            'import { omit } from "solid-js";',
            'const rest = omit(props, "name");',
        ],
        name: "no-destructure imports omit when it takes the rest",
        source: `export const OnlyRest = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['import { merge, omit } from "solid-js";'],
        name: "no-destructure imports merge and omit for defaults with a rest",
        source: `export const Both = ({ name = "x", ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['import { merge } from "solid-js";'],
        name: "no-destructure imports merge for defaults",
        source: `export const OnlyDefaults = ({ name = "x" }) => {
    return <div>{name}</div>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['import { createSignal, omit } from "solid-js";'],
        name: "no-destructure adds omit to an existing solid-js import",
        source: `import { createSignal } from "solid-js";

export const WithImport = ({ name, ...rest }) => {
    const [count] = createSignal(0);

    return <div {...rest}>{name}{count()}</div>;
};
`,
    }),
    Object.freeze({
        singleFragments: ['import { omit } from "solid-js";'],
        name: "no-destructure does not import omit twice",
        source: `import { omit } from "solid-js";

export const AlreadyImported = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['const rest = pick(props, "name");'],
        forbiddenFragments: ["omit("],
        name: "no-destructure calls omit through its local alias",
        source: `import { omit as pick } from "solid-js";

export const Aliased = ({ name, ...rest }) => {
    return <div {...rest}>{name}{String(pick)}</div>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['import { omit } from "solid-js";'],
        forbiddenFragments: ["import type { Component }, {"],
        name: "no-destructure does not extend a type-only solid-js import",
        source: `import type { Component } from "solid-js";

export const Typed: Component = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['import { Show } from "solid-js";'],
        forbiddenFragments: ["* as Solid, {"],
        name: "jsx-no-undef adds a named import next to a namespace import",
        source: `import * as Solid from "solid-js";

export const View = () => {
    return <Show when={Solid.DEV}>Visible</Show>;
};
`,
    }),
    Object.freeze({
        expectedFragments: ['import { render } from "@solidjs/web";'],
        forbiddenFragments: ["* as Web, {"],
        name: "imports moves a name next to a namespace import",
        source: `import * as Web from "@solidjs/web";
import { render } from "solid-js";

export const exported = [Web, render];
`,
    }),
]);

// Names that `solid-js` 2.0.2 exports and that must be imported from it, not
// from `@solidjs/web`.
const importsSolidJsNames = Object.freeze([
    "createDeferred",
    "createOwner",
    "createTrackedEffect",
    "from",
    "onFlush",
    "repeat",
]);

// Imports that the rule must leave alone: not exported by the package the
// rule used to point at, or exported by more than one package.
const importsSilentCases = Object.freeze([
    Object.freeze({
        name: "storePath, which solid-js no longer exports",
        source: `import { storePath } from "@solidjs/web";

export const path = storePath;
`,
    }),
    Object.freeze({
        name: "ClassValue, which only exists as JSX.ClassValue",
        source: `import type { ClassValue } from "solid-js";

export type Classes = ClassValue;
`,
    }),
    Object.freeze({
        name: "ValidComponent from @solidjs/web, which declares its own",
        source: `import type { ValidComponent } from "@solidjs/web";

export type Tag = ValidComponent;
`,
    }),
    Object.freeze({
        name: "dynamicComponent from @solidjs/web, which re-exports it",
        source: `import { dynamicComponent } from "@solidjs/web";

export const tag = dynamicComponent;
`,
    }),
]);

export { importFixCases, importsSilentCases, importsSolidJsNames };
