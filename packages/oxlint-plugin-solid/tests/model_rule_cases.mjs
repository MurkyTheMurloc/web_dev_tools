// Fixtures for the rules that encode the Solid 2.0 model: async computations,
// the server boundary and callbacks whose return value Solid drops.
//
// `reports` cases must produce the rule id and the named message fragment (the
// fragment keeps a fixture that trips another rule from passing for the wrong
// reason). `silent` cases must not produce the rule id.

const IMPORTS = `import { createEffect, createMemo, createOptimistic, createProjection, createSignal, createStore, onCleanup, onSettled } from "solid-js";

declare function load(id: number): Promise<string>;
declare function save(value: string): Promise<void>;
declare const element: HTMLElement;
`;

function withImports(body) {
    return `${IMPORTS}\n${body}\n`;
}

const reactiveAsyncReports = Object.freeze([
    Object.freeze({
        name: "signal read after await in createMemo",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    const first = await load(0);
    return first + id();
});`),
    }),
    Object.freeze({
        name: "memo read after await in createMemo",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [id] = createSignal(1);
const next = createMemo(() => id() + 1);
export const user = createMemo(async () => {
    await save("x");
    return load(next());
});`),
    }),
    Object.freeze({
        name: "props read after await",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`export const View = (props: { id: number }) => {
    const user = createMemo(async () => {
        await save("x");
        return load(props.id);
    });

    return user;
};`),
    }),
    Object.freeze({
        name: "store read after await",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [filters] = createStore({ id: 1 });
export const user = createMemo(async () => {
    await save("x");
    return load(filters.id);
});`),
    }),
    Object.freeze({
        name: "read after await in the compute phase of createEffect",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [id] = createSignal(1);
createEffect(
    async () => {
        await save("x");
        return id();
    },
    (value) => {
        console.log(value);
    },
);`),
    }),
    Object.freeze({
        name: "read after await in a createProjection",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [id] = createSignal(1);
export const rows = createProjection(async () => {
    await save("x");
    return [id()];
}, []);`),
    }),
    Object.freeze({
        name: "read after await in a function createStore",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [id] = createSignal(1);
export const [rows] = createStore(async () => {
    await save("x");
    return [id()];
}, []);`),
    }),
    Object.freeze({
        name: "read after await in createOptimistic",
        message: "UNTRACKED_READ_AFTER_AWAIT",
        code: withImports(`const [id] = createSignal(1);
export const [name] = createOptimistic(async () => {
    await save("x");
    return load(id());
});`),
    }),
    Object.freeze({
        name: "async callback that only does return await",
        message: "only does `return await",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    return await load(id());
});`),
    }),
    Object.freeze({
        name: "async expression body that is only an await",
        message: "only does `return await",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => await load(id()));`),
    }),
]);

const reactiveAsyncSilent = Object.freeze([
    Object.freeze({
        name: "returning the promise without async",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(() => load(id()));`),
    }),
    Object.freeze({
        name: "reads before the await",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    const current = id();
    const first = await load(current);
    return first + current;
});`),
    }),
    Object.freeze({
        name: "a read inside the awaited expression",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    const first = await load(id());
    return first;
});`),
    }),
    Object.freeze({
        name: "props read before the await",
        code: withImports(`export const View = (props: { id: number }) => {
    const user = createMemo(async () => {
        const id = props.id;
        await save("x");
        return load(id);
    });

    return user;
};`),
    }),
    Object.freeze({
        name: "return await inside try keeps the catch working",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    try {
        return await load(id());
    } catch {
        return "failed";
    }
});`),
    }),
    Object.freeze({
        name: "a read inside a nested function",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    await save("x");
    return () => id();
});`),
    }),
    Object.freeze({
        name: "a local that shadows the signal",
        code: withImports(`const [id] = createSignal(1);
export const user = createMemo(async () => {
    const id = () => 2;
    await save("x");
    return load(id());
});`),
    }),
    Object.freeze({
        name: "reads in the apply phase belong to another rule",
        code: withImports(`const [id] = createSignal(1);
createEffect(
    () => id(),
    async (value) => {
        await save("x");
        console.log(value, id());
    },
);`),
    }),
    Object.freeze({
        name: "an async function that is not a computation",
        code: withImports(`const [id] = createSignal(1);
export async function run() {
    await save("x");
    return id();
}`),
    }),
]);

const SERVER_MODULE = `"use server";

export async function listRows(): Promise<string[]> {
    return [];
}
`;

const PLAIN_SERVER_MODULE = `import "node:fs";

export const db = { rows: [] };
`;

const serverImportReports = Object.freeze([
    Object.freeze({
        name: "alias import of a plain module under src/server",
        fileName: "src/routes/index.tsx",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `import { db } from "~/server/db";

export const View = () => <p>{db.rows.length}</p>;
`,
    }),
    Object.freeze({
        name: "relative import of a plain module under src/server",
        fileName: "src/routes/todos.tsx",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `import { db } from "../server/db";

export const View = () => <p>{db.rows.length}</p>;
`,
    }),
    Object.freeze({
        name: "a directive that is not the first statement",
        fileName: "src/routes/late.tsx",
        files: {
            "src/server/late.ts": `export const x = 1;\n"use server";\n`,
        },
        code: `import { x } from "~/server/late";

export const View = () => <p>{x}</p>;
`,
    }),
    Object.freeze({
        name: "import from a client .ts module",
        fileName: "src/lib/api.ts",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `import { db } from "~/server/db";

export const count = db.rows.length;
`,
    }),
    Object.freeze({
        name: "index file in a directory under src/server",
        fileName: "src/routes/index-import.tsx",
        files: { "src/server/data/index.ts": PLAIN_SERVER_MODULE },
        code: `import { db } from "~/server/data";

export const View = () => <p>{db.rows.length}</p>;
`,
    }),
    Object.freeze({
        name: "re-export",
        fileName: "src/lib/reexport.ts",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `export { db } from "~/server/db";
`,
    }),
    Object.freeze({
        name: "dynamic import",
        fileName: "src/lib/lazy.ts",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `export const load = () => import("~/server/db");
`,
    }),
]);

const serverImportSilent = Object.freeze([
    Object.freeze({
        name: "a use server module",
        fileName: "src/routes/todos-ok.tsx",
        files: { "src/server/rows.ts": SERVER_MODULE },
        code: `import { listRows } from "~/server/rows";

export const View = () => <p>{String(listRows)}</p>;
`,
    }),
    Object.freeze({
        name: "a use server module with a comment before the directive",
        fileName: "src/routes/commented.tsx",
        files: {
            "src/server/commented.ts": `// server only\n/* really */\n'use server';\n\nexport async function a(): Promise<void> {}\n`,
        },
        code: `import { a } from "../server/commented";

export const View = () => <p>{String(a)}</p>;
`,
    }),
    Object.freeze({
        name: "an import written inside src/server",
        fileName: "src/server/handler.ts",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `import { db } from "./db";

export const count = db.rows.length;
`,
    }),
    Object.freeze({
        name: "a target that does not exist",
        fileName: "src/routes/missing.tsx",
        code: `import { nothing } from "~/server/not-there";

export const View = () => <p>{String(nothing)}</p>;
`,
    }),
    Object.freeze({
        name: "a type-only import",
        fileName: "src/routes/types.tsx",
        files: { "src/server/db.ts": PLAIN_SERVER_MODULE },
        code: `import type { db } from "~/server/db";

export type Db = typeof db;
`,
    }),
    Object.freeze({
        name: "a module outside src/server",
        fileName: "src/routes/outside.tsx",
        files: { "src/lib/db.ts": PLAIN_SERVER_MODULE },
        code: `import { db } from "~/lib/db";

export const View = () => <p>{db.rows.length}</p>;
`,
    }),
    Object.freeze({
        name: "a package import",
        fileName: "src/routes/package.tsx",
        code: `import { createSignal } from "solid-js";

export const [value] = createSignal(1);
`,
    }),
]);

const strictVoidReports = Object.freeze([
    Object.freeze({
        name: "expression-bodied onClick",
        message: "expression-bodied arrow",
        code: withImports(`const [count, setCount] = createSignal(0);
export const View = () => <button onClick={() => setCount(count() + 1)}>+</button>;`),
    }),
    Object.freeze({
        name: "expression-bodied onInput returning an assignment",
        message: "expression-bodied arrow",
        code: withImports(`let value = "";
export const View = () => <input onInput={(event) => (value = event.currentTarget.value)} />;`),
    }),
    Object.freeze({
        name: "namespaced on:click",
        message: "expression-bodied arrow",
        code: withImports(`export const View = () => <button on:click={() => save("x")}>Save</button>;`),
    }),
    Object.freeze({
        name: "ref callback that assigns",
        message: "expression-bodied arrow",
        code: withImports(`let input: HTMLInputElement | undefined;
export const View = () => <input ref={(el) => (input = el)} />;`),
    }),
    Object.freeze({
        name: "ref callback inside a ref array",
        message: "expression-bodied arrow",
        code: withImports(`let input: HTMLInputElement | undefined;
export const View = () => <input ref={[(el) => (input = el)]} />;`),
    }),
    Object.freeze({
        name: "onCleanup returning a value",
        message: "callback returns a value",
        code: withImports(`export const stop = () => {
    onCleanup(() => {
        return 1;
    });
};`),
    }),
    Object.freeze({
        name: "onCleanup expression body that assigns",
        message: "callback returns a value",
        code: withImports(`let active = true;
export const stop = () => {
    onCleanup(() => (active = false));
};`),
    }),
    Object.freeze({
        name: "onSettled returning something that is not a function",
        message: "not a function",
        code: withImports(`export const start = () => {
    onSettled(() => "ready");
};`),
    }),
]);

const strictVoidSilent = Object.freeze([
    Object.freeze({
        name: "block-bodied handler",
        code: withImports(`const [count, setCount] = createSignal(0);
export const View = () => <button onClick={() => { setCount(count() + 1); }}>+</button>;`),
    }),
    Object.freeze({
        name: "void-prefixed expression",
        code: withImports(`export const View = () => <button onClick={() => void save("x")}>Save</button>;`),
    }),
    Object.freeze({
        name: "handler passed by name",
        code: withImports(`const onSave = () => { void save("x"); };
export const View = () => <button onClick={onSave}>Save</button>;`),
    }),
    Object.freeze({
        name: "a signal setter passed directly to ref",
        code: withImports(`const [, setInput] = createSignal<HTMLInputElement>();
export const View = () => <input ref={setInput} />;`),
    }),
    Object.freeze({
        name: "block-bodied ref callback",
        code: withImports(`let input: HTMLInputElement | undefined;
export const View = () => <input ref={(el) => { input = el; }} />;`),
    }),
    Object.freeze({
        name: "an attribute that is not a handler",
        code: withImports(`export const View = () => <input value={(() => "x")()} class={"a"} />;`),
    }),
    Object.freeze({
        name: "onCleanup calling a function",
        code: withImports(`export const stop = (id: number) => {
    onCleanup(() => clearInterval(id));
};`),
    }),
    Object.freeze({
        name: "onSettled returning a cleanup function",
        code: withImports(`export const start = () => {
    onSettled(() => {
        const id = setInterval(() => {}, 1000);
        return () => clearInterval(id);
    });
};`),
    }),
    Object.freeze({
        name: "onSettled with a block that returns nothing",
        code: withImports(`export const start = () => {
    onSettled(() => {
        element.focus();
    });
};`),
    }),
]);

export {
    reactiveAsyncReports,
    reactiveAsyncSilent,
    serverImportReports,
    serverImportSilent,
    strictVoidReports,
    strictVoidSilent,
};
