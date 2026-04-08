const expectedRuleIds = Object.freeze([
    "components-return-once",
    "event-handlers",
    "imports",
    "jsx-no-duplicate-props",
    "jsx-no-script-url",
    "jsx-no-undef",
    "jsx-uses-vars",
    "no-array-handlers",
    "no-destructure",
    "no-innerhtml",
    "no-proxy-apis",
    "no-react-deps",
    "no-react-specific-props",
    "no-unknown-namespaces",
    "prefer-arrow-components",
    "prefer-classlist",
    "prefer-for",
    "prefer-show",
    "reactivity",
    "self-closing-comp",
    "style-prop",
    "validate-jsx-nesting",
]);

const ruleCases = Object.freeze([
    Object.freeze({
        code: `export const View = (props) => {
    if (props.visible) {
        return <div>Visible</div>;
    }

    return <span>Hidden</span>;
};
`,
        ruleId: "components-return-once",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <button onclick={() => true}>Save</button>;
};
`,
        ruleId: "event-handlers",
    }),
    Object.freeze({
        code: `import { createEffect } from "solid-js/web";

createEffect(() => {
    return true;
});
`,
        ruleId: "imports",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div class="blue" class="green" />;
};
`,
        ruleId: "jsx-no-duplicate-props",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <a href="javascript:alert('x')">Unsafe</a>;
};
`,
        ruleId: "jsx-no-script-url",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <MissingComponent />;
};
`,
        ruleId: "jsx-no-undef",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <button onClick={[(value) => value, "hello"]}>Hello</button>;
};
`,
        ruleId: "no-array-handlers",
    }),
    Object.freeze({
        code: `export const View = ({ name }) => {
    return <div>{name}</div>;
};
`,
        ruleId: "no-destructure",
    }),
    Object.freeze({
        code: `const getHtml = () => {
    return "<p>unsafe</p>";
};

export const View = () => {
    return <div innerHTML={getHtml()} />;
};
`,
        ruleId: "no-innerhtml",
    }),
    Object.freeze({
        code: `const target = { value: "ready" };
const proxy = new Proxy(target, {});

export const View = () => {
    return <div>{proxy.value}</div>;
};
`,
        ruleId: "no-proxy-apis",
    }),
    Object.freeze({
        code: `import { createEffect, createSignal } from "solid-js";

const [count] = createSignal(0);

createEffect(() => {
    return count();
}, [count()]);
`,
        ruleId: "no-react-deps",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div className="card">Hello</div>;
};
`,
        ruleId: "no-react-specific-props",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div foo:bar={null}>Hello</div>;
};
`,
        ruleId: "no-unknown-namespaces",
    }),
    Object.freeze({
        code: `interface Props {
    readonly children?: JSX.Element;
}

export function View(props: Props): JSX.Element {
    return <section>{props.children}</section>;
}
`,
        ruleId: "prefer-arrow-components",
    }),
    Object.freeze({
        code: `const cn = (classes) => {
    return classes;
};

export const View = () => {
    return <div class={cn({ red: true })}>Hello</div>;
};
`,
        ruleId: "prefer-classlist",
    }),
    Object.freeze({
        code: `export const View = (props) => {
    return <ol>{props.items.map((item) => <li>{item}</li>)}</ol>;
};
`,
        ruleId: "prefer-for",
    }),
    Object.freeze({
        code: `export const View = (props) => {
    return <div>{props.visible && <span>Visible</span>}</div>;
};
`,
        ruleId: "prefer-show",
    }),
    Object.freeze({
        code: `export const View = (props) => {
    const text = \`Hello, \${props.name}!\`;

    return <span>{text}</span>;
};
`,
        ruleId: "reactivity",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div></div>;
};
`,
        ruleId: "self-closing-comp",
    }),
    Object.freeze({
        code: `export const View = () => {
    return <div style={{ fontSize: "10px" }}>Hello</div>;
};
`,
        ruleId: "style-prop",
    }),
]);

const jsxUsesVarsCase = Object.freeze({
    code: `import type { JSX } from "solid-js";

const UsedComponent = (): JSX.Element => {
    return <div>Hello</div>;
};

export const View = (): JSX.Element => {
    return <UsedComponent />;
};
`,
});

const preferArrowFixCases = Object.freeze([
    Object.freeze({
        expectedFragment: "export const Leaf: Component<Props> = (props) => {",
        name: "uses Component for components without children",
        source: `import type { JSX } from "solid-js";

type Props = {
    readonly name: string;
};

export function Leaf(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
    }),
    Object.freeze({
        expectedFragment:
            "export const Panel: ParentComponent<Props> = (props) => {",
        name: "uses ParentComponent for components with children",
        source: `import type { JSX } from "solid-js";

type Props = {
    readonly title: string;
};

export function Panel(props: Props): JSX.Element {
    return <section>{props.children}{props.title}</section>;
}
`,
    }),
    Object.freeze({
        expectedFragment: "export const Card: Component<Props> = ({ title }: Props) => {",
        name: "preserves destructured props in arrow form",
        source: `import type { JSX } from "solid-js";

type Props = {
    readonly title: string;
};

export function Card({ title }: Props): JSX.Element {
    return <div>{title}</div>;
}
`,
    }),
    Object.freeze({
        expectedFragment: "export const Icon: Component = () => {",
        name: "handles components with no props",
        source: `import type { JSX } from "solid-js";

export function Icon(): JSX.Element {
    return <svg />;
}
`,
    }),
]);

const preferArrowDiagnosticCases = Object.freeze([
    Object.freeze({
        name: "triggers on exported PascalCase function with named props",
        source: `import type { JSX } from "solid-js";
type Props = { name: string };
export function Leaf(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
    }),
    Object.freeze({
        name: "triggers on exported PascalCase function with destructured props",
        source: `import type { JSX } from "solid-js";
type Props = { title: string };
export function Card({ title }: Props): JSX.Element {
    return <div>{title}</div>;
}
`,
    }),
    Object.freeze({
        name: "triggers on exported PascalCase function with no props",
        source: `import type { JSX } from "solid-js";
export function Icon(): JSX.Element {
    return <svg />;
}
`,
    }),
    Object.freeze({
        name: "triggers on non-exported function with JSX.Element return type",
        source: `import type { JSX } from "solid-js";
type Props = { name: string };
function Test(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
    }),
    Object.freeze({
        name: "triggers on lowercase function with JSX.Element return type",
        source: `import type { JSX } from "solid-js";
type Props = { name: string };
function test(props: Props): JSX.Element {
    return <div>{props.name}</div>;
}
`,
    }),
]);

export { expectedRuleIds, jsxUsesVarsCase, preferArrowDiagnosticCases, preferArrowFixCases, ruleCases };
