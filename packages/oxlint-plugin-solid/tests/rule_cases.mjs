const expectedRuleIds = Object.freeze([
    "components-return-once",
    "event-handlers",
    "filename-matches-export",
    "function-size",
    "imports",
    "init-declarations",
    "jsx-no-duplicate-props",
    "jsx-no-script-url",
    "jsx-no-undef",
    "jsx-uses-vars",
    "no-array-handlers",
    "no-cleanup-in-effect-apply",
    "no-destructure",
    "no-innerhtml",
    "no-module-scope-reactive-primitive",
    "no-owned-primitives-in-ref",
    "no-proxy-apis",
    "no-react-deps",
    "no-react-specific-props",
    "no-server-import-in-client",
    "no-setter-in-effect",
    "no-single-arg-create-effect",
    "no-unassigned-vars",
    "no-unknown-namespaces",
    "no-untracked-effect-read",
    "no-write-in-pure-computation",
    "prefer-arrow-components",
    "prefer-class-object",
    "prefer-destructuring",
    "prefer-for",
    "prefer-ref-shorthand",
    "prefer-show",
    "reactive-async",
    "reactivity",
    "self-closing-comp",
    "strict-void-return",
    "style-prop",
    "typed-merge-defaults",
    "validate-jsx-nesting"
]);

const ruleCases = Object.freeze([
    Object.freeze({
        code: `export const Counter = () => {
    return <button>0</button>;
};
`,
        // Not src/components/: Counter.tsx lives there in another case, and on
        // a case-sensitive file system both land in the shared temp project.
        fileName: "src/snake_case_files/counter.tsx",
        message: "Fix: rename the file to `Counter.tsx`.",
        ruleId: "filename-matches-export"
    }),
    Object.freeze({
        code: `import { createEffect, createSignal } from "solid-js";

export const View = () => {
    const [count] = createSignal(0);
    createEffect(() => console.log(count()));
    return <div />;
};
`,
        message:
            "Fix: split it into a tracked compute that reads the values and an untracked effect that does the work, `createEffect(() => source(), (value) => doWork(value))`",
        ruleId: "no-single-arg-create-effect"
    }),
    Object.freeze({
        code: `export const Greeting = ({ name = "you", id }) => {
    return <p id={id}>{name}</p>;
};
`,
        message:
            'Fix: take `_props` as the parameter and read `props.name`, `props.id` where each value is used, after `const props = merge({ name: "you" }, _props);` as the first line of the body.',
        ruleId: "no-destructure"
    }),
    Object.freeze({
        code: `export const View = (props) => {
    if (props.visible) {
        return <div>Visible</div>;
    }

    return <span>Hidden</span>;
};
`,
        message:
            "Fix: one return with the condition in JSX, `return <Show when={props.visible} fallback={<span>Hidden</span>}><div>Visible</div></Show>;`",
        ruleId: "components-return-once"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <button onclick={() => true}>Save</button>;
};
`,
        message:
            "only `on` followed by an uppercase letter is, so `onclick` is set as an attribute and a function value is never called. Fix: `onClick`.",
        ruleId: "event-handlers"
    }),
    Object.freeze({
        code: `import { render } from "solid-js";

render(() => <div />, document.body);
`,
        message: 'Fix: `import { render } from "@solidjs/web";`.',
        ruleId: "imports"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div class="blue" class="green" />;
};
`,
        message:
            'Fix: one `class` with both values in the array form, `class={["blue", "green"]}`.',
        ruleId: "jsx-no-duplicate-props"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <a href="javascript:alert('x')">Unsafe</a>;
};
`,
        message:
            'Fix: run the code in an event handler, `<button type="button" onClick={() => …}>`',
        ruleId: "jsx-no-script-url"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <MissingComponent />;
};
`,
        message: "Fix: import `MissingComponent` or fix its spelling.",
        ruleId: "jsx-no-undef"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <button onClick={[(value) => value, "hello"]}>Hello</button>;
};
`,
        message:
            'Fix: `onClick={(event) => ((value) => value)("hello", event)}`.',
        ruleId: "no-array-handlers"
    }),
    Object.freeze({
        code: `export const View = ({ name }) => {
    return <div>{name}</div>;
};
`,
        ruleId: "no-destructure"
    }),
    Object.freeze({
        code: `const getHtml = () => {
    return "<p>unsafe</p>";
};

export const View = () => {
    return <div innerHTML={getHtml()} />;
};
`,
        message:
            "Fix: for text, render it as a child, `<div>{getHtml()}</div>`",
        ruleId: "no-innerhtml"
    }),
    Object.freeze({
        code: `const target = { value: "ready" };
const proxy = new Proxy(target, {});

export const View = () => {
    return <div>{proxy.value}</div>;
};
`,
        // Off in oxc-config (it is for targets without Proxy), on for its test.
        rules: { "solid/no-proxy-apis": "error" },
        message: "Fix: use a plain object, with getters",
        ruleId: "no-proxy-apis"
    }),
    Object.freeze({
        code: `import { createEffect, createSignal } from "solid-js";

const [count] = createSignal(0);

createEffect(() => {
    return count();
}, [count()]);
`,
        message:
            "Fix: `createEffect(() => ({ count: count() }), ({ count }) => { … })`, reading each dependency in the compute function",
        ruleId: "no-react-deps"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div className="card">Hello</div>;
};
`,
        message: 'Fix: `class="card"`.',
        ruleId: "no-react-specific-props"
    }),
    Object.freeze({
        code: `import { createEffect, createSignal } from "solid-js";

const [firstName] = createSignal("Ada");
const [, setFullName] = createSignal("");

createEffect(
    () => firstName(),
    (first) => {
        setFullName(first + " Lovelace");
    },
);
`,
        message:
            "Fix: delete the effect and the signal and derive the value where it is read, with a plain function, `const fullName = () => …`, or `createMemo(() => …)`",
        ruleId: "no-setter-in-effect"
    }),
    Object.freeze({
        code: `import { createEffect, createSignal } from "solid-js";

const [query] = createSignal("");
const [, setResults] = createSignal([]);

createEffect(
    () => query(),
    async (value) => {
        const found = await fetch(value).then((response) => response.json());
        setResults(found);
    },
);
`,
        message:
            "Fix: derive the value with an async memo, `const results = createMemo(async () => { … })`, read `results()` inside `<Loading>`",
        ruleId: "no-setter-in-effect"
    }),
    Object.freeze({
        code: `import { createEffect, createSignal } from "solid-js";

const [roomId] = createSignal("lobby");
const [theme] = createSignal("dark");

createEffect(
    () => roomId(),
    (id) => {
        connect(id, theme());
    },
);
`,
        message:
            "Fix: read it in the compute and take it as an argument, `createEffect(() => ({ id: roomId(), theme: theme() }), ({ id, theme }) => { … })`",
        ruleId: "no-untracked-effect-read"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div foo:bar={null}>Hello</div>;
};
`,
        message: "Fix: the plain name `bar`",
        ruleId: "no-unknown-namespaces"
    }),
    Object.freeze({
        code: `import type { JSX } from "@solidjs/web";

interface Props {
    readonly children?: JSX.Element;
}

export function View(props: Props): JSX.Element {
    return <section>{props.children}</section>;
}
`,
        message:
            'Fix: `export const View: ParentComponent<Props> = (props) => { … };` with `import type { ParentComponent } from "solid-js";`.',
        ruleId: "prefer-arrow-components"
    }),
    Object.freeze({
        code: `export const View = (props) => {
    return <div classList={{ active: props.on }}>Hello</div>;
};
`,
        message: "Fix: `class={{ active: props.on }}`.",
        ruleId: "prefer-class-object"
    }),
    Object.freeze({
        code: `import { createContext, createRoot, createSignal } from "@solidjs/web";

export const primitives = [createContext, createRoot, createSignal];
`,
        message: 'Fix: `import { createContext } from "solid-js";`.',
        ruleId: "imports"
    }),
    Object.freeze({
        code: `import { createEffect, createSignal, onCleanup } from "solid-js";

export const View = () => {
    const [width] = createSignal(0);

    return (
        <div
            ref={(element) => {
                createEffect(
                    () => width(),
                    (value) => element.setAttribute("data-width", value),
                );
                onCleanup(() => element.remove());
            }}
        >
            Hello
        </div>
    );
};
`,
        message:
            "Fix: call `createEffect` in the component body, or in a directive factory",
        ruleId: "no-owned-primitives-in-ref"
    }),
    Object.freeze({
        code: `import { createTrackedEffect } from "solid-js";

createTrackedEffect(() => {});
`,
        message:
            "Fix: move `createTrackedEffect(() => {})` into the component that uses it",
        ruleId: "no-module-scope-reactive-primitive"
    }),
    Object.freeze({
        code: `import { createMemo, createSignal } from "solid-js";

export const View = () => {
    const [count, setCount] = createSignal(0);
    const doubled = createMemo(() => {
        setCount(1);
        return count() * 2;
    });
    return <div>{doubled()}</div>;
};
`,
        message:
            "Fix: return the value from the `createMemo` callback and read the memo where the state behind 'setCount' was read",
        ruleId: "no-write-in-pure-computation"
    }),
    Object.freeze({
        code: `declare const config: { port: number };

export const port = config.port;
`,
        fileName: "config.ts",
        message: "Fix: `const { port } = config`",
        ruleId: "prefer-destructuring"
    }),
    Object.freeze({
        code: `import { merge } from "solid-js";

type Props = { variant?: "primary" | "secondary" };

export const Button = (props: Props) => {
    const local = merge({ variant: "primary" }, props);
    return <button class={local.variant}>Go</button>;
};
`,
        message: 'Fix: `{ variant: "primary" } satisfies Partial<Props>`',
        ruleId: "typed-merge-defaults"
    }),
    Object.freeze({
        code: `const cn = (classes) => {
    return classes;
};

export const View = () => {
    return <div class={cn({ red: true })}>Hello</div>;
};
`,
        message: "Fix: `class={{ red: true }}`.",
        ruleId: "prefer-class-object"
    }),
    Object.freeze({
        code: `export const View = (props) => {
    return <ol>{props.items.map((item) => <li>{item}</li>)}</ol>;
};
`,
        message:
            "Fix: `<For each={props.items}>{(item) => <li>{item}</li>}</For>`.",
        ruleId: "prefer-for"
    }),
    Object.freeze({
        code: `export const View = (props) => {
    return <div>{props.visible && <span>Visible</span>}</div>;
};
`,
        message:
            "Fix: `<Show when={props.visible}><span>Visible</span></Show>`",
        ruleId: "prefer-show"
    }),
    Object.freeze({
        code: `export const View = (props) => {
    const text = \`Hello, \${props.name}!\`;

    return <span>{text}</span>;
};
`,
        ruleId: "reactivity"
    }),
    Object.freeze({
        code: `import { createMemo, createSignal } from "solid-js";

declare function load(id: number): Promise<string>;

export const createUser = (): unknown => {
    const [id] = createSignal(1);
    const first = createMemo(async () => {
        await load(0);
        return load(id());
    });

    return first;
};
`,
        ruleId: "reactive-async"
    }),
    Object.freeze({
        code: `import { createDeferred, createSignal } from "solid-js";

declare function load(id: number): Promise<string>;

export const createUser = (): unknown => {
    const [id] = createSignal(1);
    const first = createDeferred(async () => {
        await load(0);
        return load(id());
    });

    return first;
};
`,
        ruleId: "reactive-async"
    }),
    Object.freeze({
        code: `import { db } from "~/server/db";

export const rows = db.rows;
`,
        fileName: "src/routes/index.tsx",
        files: {
            "src/server/db.ts": "export const db = { rows: [] };\n"
        },
        message: "Fix: import a server function module instead",
        ruleId: "no-server-import-in-client"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <button onClick={() => console.log("x")}>Save</button>;
};
`,
        message: 'Fix: a block body, `onClick={() => { console.log("x"); }}`.',
        ruleId: "strict-void-return"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div></div>;
};
`,
        message: "Fix: `<div />`.",
        ruleId: "self-closing-comp"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div style={{ fontSize: "10px" }}>Hello</div>;
};
`,
        message: 'Fix: `"font-size": "10px"`.',
        ruleId: "style-prop"
    }),
    Object.freeze({
        code: `export const View = () => {
    return <p><div>Hello</div></p>;
};
`,
        message: "Fix: move the `<div>` out of the `<p>`",
        ruleId: "validate-jsx-nesting"
    }),
    Object.freeze({
        code: `export const View = (props: { on: boolean }) => {
    let label: string;
    if (props.on) {
        label = "on";
    }
    return <p>{label}</p>;
};
`,
        message:
            "`let label` has no initial value and no `ref` assigns it, so every read before the first write gets `undefined`. Fix: give it its start value, `let label = …;`: a real default, `= undefined` for an `Optional<T>`",
        ruleId: "init-declarations"
    }),
    Object.freeze({
        code: `export const View = () => {
    let el!: HTMLDivElement;
    return <div ref={(node) => { el = node; }} onClick={() => el.focus()} />;
};
`,
        message:
            "The `ref` callback `(node) => { el = node; }` only stores the element in `el`, which `ref={el}` does on its own: Solid's compiler rewrites a single `ref` variable to that assignment. Fix: `ref={el}`.",
        ruleId: "prefer-ref-shorthand"
    }),
    Object.freeze({
        code: `declare const autofocus: (el: HTMLElement) => void;

export const View = () => {
    let el!: HTMLInputElement;
    return <input ref={[autofocus, el]} onInput={() => el.select()} />;
};
`,
        message:
            "`el` in the `ref` array is never assigned and stays `undefined`: Solid rewrites only a single `ref={el}` to an assignment, and an array entry must be a callback. Fix: `(node) => { el = node; }` in its place.",
        ruleId: "prefer-ref-shorthand"
    }),
    Object.freeze({
        code: `declare function use(value: unknown): void;

export const View = () => {
    let label: string | undefined;
    use(label);
    return <p />;
};
`,
        message:
            "`label` is read but never assigned, so it is always `undefined`. Fix: assign it before it is read, or, if it should hold an element, pass it as `ref={label}`.",
        ruleId: "no-unassigned-vars"
    })
]);

const jsxUsesVarsCase = Object.freeze({
    code: `import type { JSX } from "@solidjs/web";

const UsedComponent = (): JSX.Element => {
    return <div>Hello</div>;
};

export const View = (): JSX.Element => {
    return <UsedComponent />;
};
`
});

const noDestructureFixCases = Object.freeze([
    Object.freeze({
        expectedFragment: 'const rest = omit(props, "name");',
        name: "extracts the rest with omit",
        source: `export const OnlyRest = ({ name, ...rest }) => {
    return <div {...rest}>{name}</div>;
};
`
    }),
    Object.freeze({
        expectedFragment: 'const props = merge({ name: "x" }, _props);',
        name: "merges defaults with merge",
        source: `export const OnlyDefaults = ({ name = "x" }) => {
    return <div>{name}</div>;
};
`
    })
]);

const preferArrowFixCases = Object.freeze([
    Object.freeze({
        expectedFragment: "export const Leaf: Component<Props> = (props) => {",
        name: "uses Component for components without children",
        source: `import type { JSX } from "@solidjs/web";

type Props = {
    readonly name: string;
};

export function Leaf(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`
    }),
    Object.freeze({
        expectedFragment:
            "export const Panel: ParentComponent<Props> = (props) => {",
        name: "uses ParentComponent for components with children",
        source: `import type { JSX } from "@solidjs/web";

type Props = {
    readonly title: string;
};

export function Panel(props: Props): JSX.Element {
    return <section>{props.children}{props.title}</section>;
}
`
    }),
    Object.freeze({
        expectedFragment:
            "export const Card: Component<Props> = ({ title }: Props) => {",
        name: "preserves destructured props in arrow form",
        source: `import type { JSX } from "@solidjs/web";

type Props = {
    readonly title: string;
};

export function Card({ title }: Props): JSX.Element {
    return <div>{title}</div>;
}
`
    }),
    Object.freeze({
        expectedFragment: "export const Icon: Component = () => {",
        name: "handles components with no props",
        source: `import type { JSX } from "@solidjs/web";

export function Icon(): JSX.Element {
    return <svg />;
}
`
    }),
    Object.freeze({
        expectedFragment: "const Test: Component<Props> = (props) => {",
        name: "fixes non-exported function without adding export",
        source: `import type { JSX } from "@solidjs/web";

type Props = { name: string };

function Test(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`
    }),
    Object.freeze({
        expectedFragment: "const test: Component<Props> = (props) => {",
        name: "fixes lowercase non-exported function without adding export",
        source: `import type { JSX } from "@solidjs/web";

type Props = { name: string };

function test(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`
    })
]);

const preferArrowDiagnosticCases = Object.freeze([
    Object.freeze({
        name: "triggers on exported PascalCase function with named props",
        source: `import type { JSX } from "@solidjs/web";
type Props = { name: string };
export function Leaf(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`
    }),
    Object.freeze({
        name: "triggers on exported PascalCase function with destructured props",
        source: `import type { JSX } from "@solidjs/web";
type Props = { title: string };
export function Card({ title }: Props): JSX.Element {
    return <div>{title}</div>;
}
`
    }),
    Object.freeze({
        name: "triggers on exported PascalCase function with no props",
        source: `import type { JSX } from "@solidjs/web";
export function Icon(): JSX.Element {
    return <svg />;
}
`
    }),
    Object.freeze({
        name: "triggers on non-exported function with JSX.Element return type",
        source: `import type { JSX } from "@solidjs/web";
type Props = { name: string };
function Test(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`
    }),
    Object.freeze({
        name: "triggers on lowercase function with JSX.Element return type",
        source: `import type { JSX } from "@solidjs/web";
type Props = { name: string };
function test(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`
    })
]);

// no-unknown-namespaces with and without `allowedNamespaces`. `report` is the
// message the rule must print, `null` means the rule stays silent. The
// fixtures are written the way our components are: `const X: Component<P>`.
const ISLAND_VIEW = `import type { Component } from "solid-js";

type IslandProps = Readonly<Record<string, unknown>>;

const Island: Component<IslandProps> = () => {
    return null;
};

export const View: Component = () => {
    return <Island client:visible />;
};
`;
const ALLOW_CLIENT = Object.freeze({
    "solid/no-unknown-namespaces": ["error", { allowedNamespaces: ["client"] }]
});
// What the rule says about a namespaced prop on the Island component.
const componentMessage = (prop) =>
    `\`${prop}\` on \`<Island>\` is a namespaced prop, and Solid gives a namespace no meaning on a component. Fix: a plain prop name, or, when a framework handles it (an island directive), allow it with this rule's \`allowedNamespacedProps\` option (\`"${prop}"\`).`;
// soferno's island directives: the six strategies its runtime implements.
const ALLOW_ISLAND_DIRECTIVES = Object.freeze({
    "solid/no-unknown-namespaces": [
        "error",
        {
            allowedNamespacedProps: [
                "client:delay",
                "client:hover",
                "client:idle",
                "client:load",
                "client:media",
                "client:visible"
            ]
        }
    ]
});

function islandView(prop) {
    return `import type { Component } from "solid-js";

type IslandProps = Readonly<Record<string, unknown>>;

const Island: Component<IslandProps> = () => {
    return null;
};

export const View: Component = () => {
    return <Island ${prop} />;
};
`;
}
const namespaceCases = Object.freeze([
    Object.freeze({
        code: `declare const points: () => number[];

export const View = () => <my-chart prop:data={points()} />;
`,
        name: "prop: on a custom element sets a property",
        report: null
    }),
    Object.freeze({
        code: ISLAND_VIEW,
        name: "an allowed namespace on a component",
        report: null,
        rules: ALLOW_CLIENT
    }),
    Object.freeze({
        code: ISLAND_VIEW,
        name: "a namespace on a component without the option",
        report: componentMessage("client:visible")
    }),
    Object.freeze({
        code: `import type { Component } from "solid-js";

export const View: Component = () => {
    return <div client:foo="a" />;
};
`,
        name: "an allowed namespace on a DOM element",
        report: null,
        rules: ALLOW_CLIENT
    }),
    Object.freeze({
        code: `import type { Component } from "solid-js";

declare const onClick: () => void;

export const View: Component = () => {
    return <div on:click={onClick} />;
};
`,
        name: "a removed namespace the option does not cover",
        report: "`on:click` uses the `on:` namespace, which Solid 2.0 removed. Event props are camelCase. Fix: `onClick={onClick}`.",
        rules: ALLOW_CLIENT
    }),
    Object.freeze({
        code: islandView("client:visible"),
        name: "an allowed namespaced prop on a component",
        report: null,
        rules: ALLOW_ISLAND_DIRECTIVES
    }),
    Object.freeze({
        code: islandView('client:media="(min-width: 40rem)"'),
        name: "another allowed namespaced prop on a component",
        report: null,
        rules: ALLOW_ISLAND_DIRECTIVES
    }),
    Object.freeze({
        code: islandView('client:network="4g"'),
        name: "a prop of an allowed namespace that is not in the list",
        report: componentMessage("client:network"),
        rules: ALLOW_ISLAND_DIRECTIVES
    }),
    Object.freeze({
        code: islandView("client:visble"),
        name: "a misspelled directive",
        report: componentMessage("client:visble"),
        rules: ALLOW_ISLAND_DIRECTIVES
    }),
    Object.freeze({
        code: `import type { Component } from "solid-js";

export const View: Component = () => {
    return <div client:visible />;
};
`,
        name: "an allowed namespaced prop on a DOM element",
        report: null,
        rules: ALLOW_ISLAND_DIRECTIVES
    }),
    Object.freeze({
        code: `import type { Component } from "solid-js";

export const View: Component = () => {
    return (
        <svg>
            <use xlink:href="#a" />
        </svg>
    );
};
`,
        name: "xlink on an SVG element",
        report: null
    })
]);

// Fix-on-save in editors applies suggestions, including the ones marked as
// changing behaviour. None of them may touch a namespaced prop.
const namespaceFixCases = Object.freeze([
    Object.freeze({
        code: ISLAND_VIEW,
        name: "a namespace on a component without the option"
    }),
    Object.freeze({
        code: ISLAND_VIEW,
        name: "an allowed namespace on a component",
        rules: ALLOW_CLIENT
    })
]);

function preferShowView(expression) {
    return `import type { Component } from "solid-js";

declare const label: string;

export const View: Component<{ count: number; on: boolean }> = (props) => {
    return <div>{${expression}}</div>;
};
`;
}
// \`fix\`: what --fix leaves in the source. \`suggestion\`: what
// --fix-suggestions leaves. null: the rule stays silent.
const preferShowCases = Object.freeze([
    Object.freeze({
        code: preferShowView('props.on ? label : "off"'),
        name: "a ternary with an Identifier branch",
        report: null
    }),
    Object.freeze({
        code: preferShowView("props.on && label"),
        name: "an && with an Identifier branch",
        report: null
    }),
    Object.freeze({
        code: preferShowView("props.on ? (<b>on</b>) : <i>off</i>"),
        fix: "<div><Show when={props.on} fallback={<i>off</i>}><b>on</b></Show></div>",
        name: "a ternary with JSX branches",
        report: "Fix: `<Show when={props.on} fallback={<i>off</i>}><b>on</b></Show>`."
    }),
    Object.freeze({
        code: preferShowView("props.count && <span>new</span>"),
        fix: null,
        name: "an && with a JSX branch",
        report: "Fix: `<Show when={props.count}><span>new</span></Show>`; `<Show>` renders nothing for every falsy value.",
        suggestion:
            "<div><Show when={props.count}><span>new</span></Show></div>"
    })
]);

// A \`let\` a \`ref\` assigns may stay uninitialized; \`silent\` lists the rules
// that stay quiet on the case.
const refSilentCases = Object.freeze([
    Object.freeze({
        code: `export const View = () => {
    let count = 0;
    return <button onClick={() => (count += 1)}>{count}</button>;
};
`,
        name: "a let with a default",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `export const View = () => {
    let el!: HTMLDivElement;
    return <div ref={el} onClick={() => el.focus()} />;
};
`,
        name: "let el! with the shorthand",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `export const View = () => {
    let el!: HTMLDivElement;
    return <div ref={(node) => { el = node; node.focus(); }} />;
};
`,
        name: "let el! with a callback",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `declare const autofocus: (el: HTMLElement) => void;

export const View = () => {
    let el!: HTMLInputElement;
    return <input ref={[autofocus, (node) => { el = node; }]} onInput={() => el.select()} />;
};
`,
        name: "let el! with a callback in a ref array",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `import { Show } from "solid-js";

type Optional<T> = T | undefined;

export const View = (props: { open: boolean }) => {
    let dialog: Optional<HTMLDialogElement>;
    return (
        <Show when={props.open}>
            <dialog ref={dialog} onClose={() => dialog?.close()} />
        </Show>
    );
};
`,
        name: "Optional<T> under <Show>",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `export const View = () => {
    let el: HTMLDivElement | undefined;
    return <div ref={el!} onClick={() => el?.focus()} />;
};
`,
        name: "the shorthand with a non-null assertion",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `import type { Component } from "solid-js";

type DialogApi = { open: () => void };

declare const Dialog: Component<{ ref: DialogApi }>;

export const View = () => {
    let api!: DialogApi;
    return (
        <>
            <Dialog ref={api} />
            <button onClick={() => api.open()}>Open</button>
        </>
    );
};
`,
        name: "a ref on a component",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    }),
    Object.freeze({
        code: `export const View = (props: { on: boolean }) => {
    let label: string;
    if (props.on) {
        label = "on";
    }
    return <p>{label}</p>;
};
`,
        name: "a let assigned in the body",
        silent: ["no-unassigned-vars", "prefer-ref-shorthand"]
    }),
    Object.freeze({
        code: `type Optional<T> = T | undefined;

export const View = () => {
    let el: Optional<HTMLDivElement> = undefined;
    return <div ref={el} onClick={() => el?.focus()} />;
};
`,
        name: "Optional<T> with an explicit undefined",
        silent: [
            "init-declarations",
            "no-unassigned-vars",
            "prefer-ref-shorthand"
        ]
    })
]);

// Read, never assigned, and no single \`ref\` assigns it.
const unassignedReportingCases = Object.freeze([
    Object.freeze({
        code: `declare function use(value: unknown): void;

export const View = () => {
    let x;
    use(x);
    return <p />;
};
`,
        name: "a let that is only read"
    }),
    Object.freeze({
        code: `export const View = () => {
    let el: HTMLDivElement | undefined;
    return <div ref={() => el} />;
};
`,
        name: "a ref callback that reads the variable"
    }),
    Object.freeze({
        code: `import type { Component } from "solid-js";

declare const Comp: Component<{ elRef: HTMLElement | undefined }>;

export const View = () => {
    let el: HTMLElement | undefined;
    return <Comp elRef={el} />;
};
`,
        name: "a prop that is not `ref`"
    })
]);

// \`fix\`: what --fix leaves in the source. \`suggestion\`: what
// --fix-suggestions leaves.
const refFixCases = Object.freeze([
    Object.freeze({
        code: `export const View = () => {
    let el!: HTMLDivElement;
    return <div ref={(node) => (el = node)} onClick={() => el.focus()} />;
};
`,
        fix: "<div ref={el} ",
        name: "a callback that only stores becomes the shorthand"
    }),
    Object.freeze({
        code: `declare const autofocus: (el: HTMLElement) => void;

export const View = () => {
    let el!: HTMLInputElement;
    return <input ref={[autofocus, el]} onInput={() => el.select()} />;
};
`,
        fix: "<input ref={[autofocus, el]} ",
        name: "a bare variable in a ref array",
        suggestion: "<input ref={[autofocus, (node) => { el = node; }]} "
    })
]);

// Reading a prop or a store field into a local is what Solid code should not
// destructure: the reactive form is \`props.title\` where it is used.
const preferDestructuringSilentCase = Object.freeze({
    code: `import { createStore, merge } from "solid-js";

export const Card = (props: { title: string; size: number }) => {
    const local = merge({ size: 1 }, props);
    const [store] = createStore({ items: [] as string[] });
    return (
        <div>
            {props.title}
            {local.size}
            {store.items.length}
        </div>
    );
};

export function readTitle(props: { title: string }): string {
    const title = props.title;
    return title;
}
`
});

// `report` is a fragment of the solid/filename-matches-export message, or
// null when the rule stays silent.
const filenameCases = Object.freeze([
    Object.freeze({
        name: "a PascalCase re-export of a component",
        code: `export { default as Counter } from "./CounterComponent";
`,
        fileName: "src/islands/Counter.tsx",
        report: null
    }),
    Object.freeze({
        name: "a fixture exporting test components",
        code: `export const PlainPage = () => <main />;
export const OtherPage = () => <main />;
`,
        fileName: "src/renderer/script_injection.fixture.tsx",
        report: null
    }),
    Object.freeze({
        name: "a PascalCase file named after its component",
        code: `export const Counter = () => {
    return <button>0</button>;
};
`,
        fileName: "src/components/Counter.tsx",
        report: null
    }),
    Object.freeze({
        name: "a snake_case module that exports a renderer function",
        code: `export const solidSsrRenderer = () => {
    return <div />;
};
`,
        fileName: "src/renderer/solid_ssr_renderer.tsx",
        report: null
    }),
    Object.freeze({
        name: "a file named after another component",
        code: `const Counter = () => {
    return <button>0</button>;
};

export default Counter;
`,
        fileName: "src/components/Clicker.tsx",
        report: "Fix: rename the file to `Counter.tsx`."
    }),
    Object.freeze({
        name: "a component and its helpers, named after the component",
        code: `export const filterProps = (props: object) => props;

export function IslandsPage() {
    return <main />;
}
`,
        fileName: "src/shared/IslandsPage.tsx",
        report: null
    }),
    Object.freeze({
        name: "a component in a snake_case file",
        code: `export const IslandsPage = () => {
    return <main />;
};
`,
        fileName: "src/shared/islands_page.tsx",
        report: "Fix: rename the file to `IslandsPage.tsx`."
    }),
    Object.freeze({
        name: "an island infix kept in the new name",
        code: `export const Slider = () => {
    return <input type="range" />;
};
`,
        fileName: "src/components/slider.island.tsx",
        report: "Fix: rename the file to `Slider.island.tsx`."
    }),
    Object.freeze({
        name: "a PascalCase file without a component",
        code: `import { createContext } from "solid-js";

export type Theme = "dark" | "light";
export const ThemeContext = createContext<Theme>("dark");
export { Show } from "solid-js";
export const readTheme = () => <span />;
`,
        fileName: "src/contexts/ThemeContext.tsx",
        report: "Fix: rename the file to `theme_context.tsx`."
    }),
    Object.freeze({
        name: "an index.tsx",
        code: `export const Counter = () => {
    return <button>0</button>;
};
`,
        fileName: "src/components/index.tsx",
        report: null
    }),
    Object.freeze({
        name: "a page under pages/",
        code: `export default function Home() {
    return <main />;
}
`,
        fileName: "src/pages/about.tsx",
        report: null
    })
]);

// `count` lines of code, one statement each, indented for a function body.
function codeLines(count, indent = "    ") {
    return Array.from({ length: count }, (_, index) => {
        return `${indent}total += ${index};`;
    }).join("\n");
}

// The shared config warns with `{ max: 60, maxComponent: 80 }`.
const functionSizeCases = Object.freeze([
    Object.freeze({
        name: "a long plain function",
        code: `export function sumSteps(): number {
    let total = 0;
    if (total === 0) {
${codeLines(10, "        ")}
    }
${codeLines(55)}
    return total;
}
`,
        fileName: "src/sum_steps.ts",
        report: [
            "`sumSteps` has 71 code lines (max 60; blank and comment lines don't count)",
            "Fix: move each self-contained step (lines 3–14 first) into a named pure helper"
        ]
    }),
    Object.freeze({
        name: "a long component",
        code: `export const Steps = () => {
    let total = 0;
${codeLines(80)}
    return <p>{total}</p>;
};
`,
        fileName: "src/Steps.tsx",
        report: [
            "Component `Steps` has 84 code lines (max 80)",
            "Fix: move repeated or self-contained JSX into a sub-component in its own PascalCase `.tsx`"
        ]
    }),
    Object.freeze({
        name: "a component between max and maxComponent",
        code: `export const Steps = () => {
    let total = 0;
${codeLines(70)}
    return <p>{total}</p>;
};
`,
        fileName: "src/Steps.tsx",
        report: null
    }),
    Object.freeze({
        name: "a long primitive",
        code: `export const createSteps = (): (() => number) => {
    let total = 0;
${codeLines(60)}
    return () => total;
};
`,
        fileName: "src/create_steps.ts",
        report: [
            "Primitive `createSteps` has 64 code lines (max 60",
            "Fix: split it by concern into smaller `createX` primitives (lines 2–2 first)"
        ]
    }),
    Object.freeze({
        name: "a short function",
        code: `export function sumSteps(): number {
    let total = 0;
${codeLines(5)}
    return total;
}
`,
        fileName: "src/sum_steps.ts",
        report: null
    }),
    Object.freeze({
        name: "blank and comment lines",
        code: `export function sumSteps(): number {
    let total = 0;
${codeLines(50)}
${"\n".repeat(20)}
${"    // a comment line\n".repeat(10)}
    /*
${"     * a block comment line\n".repeat(10)}
     */
    return total; // a trailing comment keeps the line
}
`,
        fileName: "src/sum_steps.ts",
        report: null
    })
]);

export {
    filenameCases,
    functionSizeCases,
    preferDestructuringSilentCase,
    expectedRuleIds,
    jsxUsesVarsCase,
    namespaceCases,
    namespaceFixCases,
    noDestructureFixCases,
    preferArrowDiagnosticCases,
    preferArrowFixCases,
    preferShowCases,
    refFixCases,
    refSilentCases,
    ruleCases,
    unassignedReportingCases
};
