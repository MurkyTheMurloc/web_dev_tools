// Reads the RuleTester cases out of eslint-plugin-solid's test files and writes
// them to upstream/cases.json. Parses only; no upstream code runs.
//
//   gh repo clone solidjs/eslint-plugin-solid /tmp/eslint-plugin-solid
//   git -C /tmp/eslint-plugin-solid checkout <UPSTREAM_COMMIT>
//   bun upstream/extract.mjs /tmp/eslint-plugin-solid && bun run --cwd ../.. format
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

import { parse } from "@babel/parser";

export const UPSTREAM_COMMIT = "d3e946c";
export const UPSTREAM_VERSION = "0.20.1";

const CASES_PATH = new URL("./cases.json", import.meta.url);

function stringValue(node, constants) {
    if (!node) {
        return undefined;
    }
    if (node.type === "StringLiteral") {
        return node.value;
    }
    if (node.type === "Identifier") {
        const value = constants[node.name];
        return typeof value === "string" ? value : undefined;
    }
    if (node.type === "BinaryExpression" && node.operator === "+") {
        const left = stringValue(node.left, constants);
        const right = stringValue(node.right, constants);
        return typeof left === "string" && typeof right === "string"
            ? left + right
            : undefined;
    }
    if (node.type !== "TemplateLiteral") {
        return undefined;
    }
    let text = "";
    for (const [index, quasi] of node.quasis.entries()) {
        text += quasi.value.cooked;
        const expression = node.expressions[index];
        if (expression) {
            const value = stringValue(expression, constants);
            if (typeof value !== "string") {
                return undefined;
            }
            text += value;
        }
    }
    return text;
}

function jsonValue(node, constants) {
    switch (node?.type) {
        case "StringLiteral":
        case "NumericLiteral":
        case "BooleanLiteral": {
            return node.value;
        }
        case "NullLiteral": {
            return null;
        }
        case "TemplateLiteral":
        case "BinaryExpression": {
            return stringValue(node, constants);
        }
        case "ArrayExpression": {
            return node.elements.map((element) =>
                jsonValue(element, constants)
            );
        }
        case "ObjectExpression": {
            const object = {};
            for (const property of node.properties) {
                if (property.type === "ObjectProperty") {
                    const key = property.key.name ?? property.key.value;
                    object[key] = jsonValue(property.value, constants);
                }
            }
            return object;
        }
        case "Identifier": {
            return constants[node.name];
        }
        case "TSAsExpression":
        case "TSSatisfiesExpression": {
            return jsonValue(node.expression, constants);
        }
        default: {
            return undefined;
        }
    }
}

function walk(node, visit) {
    if (!node || typeof node.type !== "string") {
        return;
    }
    visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            for (const child of value) {
                walk(child, visit);
            }
        } else if (value && typeof value.type === "string") {
            walk(value, visit);
        }
    }
}

function readCase(element, constants, file) {
    if (element.type !== "ObjectExpression") {
        const code = stringValue(element, constants);
        return typeof code === "string"
            ? { code, file, line: element.loc.start.line }
            : undefined;
    }
    const object = jsonValue(element, constants);
    if (typeof object?.code !== "string") {
        return undefined;
    }
    const errors = Array.isArray(object.errors) ? object.errors : undefined;
    return {
        code: object.code,
        errors: errors ? errors.length : object.errors,
        file,
        line: element.loc.start.line,
        options: object.options,
        output: object.output,
        settings: object.settings
    };
}

function extractFile(rulesDirectory, file, result) {
    const source = readFileSync(`${rulesDirectory}/${file}`, "utf8");
    const ast = parse(source, {
        plugins: ["typescript"],
        sourceType: "module"
    });
    const constants = {};
    walk(ast.program, (node) => {
        if (
            node.type === "VariableDeclarator" &&
            node.id.type === "Identifier"
        ) {
            const value = jsonValue(node.init, constants);
            if (value !== undefined) {
                constants[node.id.name] = value;
            }
        }
    });
    walk(ast.program, (node) => {
        if (node.type !== "CallExpression" || node.callee.name !== "run") {
            return;
        }
        const [nameNode, , testsNode] = node.arguments;
        const rule = (result[nameNode.value] ??= {
            invalid: [],
            skipped: 0,
            valid: []
        });
        for (const property of testsNode.properties ?? []) {
            const kind = property.key.name;
            if (kind !== "valid" && kind !== "invalid") {
                continue;
            }
            for (const element of property.value.elements ?? []) {
                const testCase = readCase(element, constants, file);
                if (testCase) {
                    rule[kind].push(testCase);
                } else {
                    rule.skipped += 1;
                }
            }
        }
    });
}

function main() {
    const [clonePath] = process.argv.slice(2);
    if (!clonePath) {
        throw new Error(
            "usage: bun upstream/extract.mjs <eslint-plugin-solid clone>"
        );
    }
    const head = spawnSync(
        "git",
        ["-C", clonePath, "rev-parse", "--short=7", "HEAD"],
        {
            encoding: "utf8"
        }
    ).stdout.trim();
    if (head !== UPSTREAM_COMMIT) {
        throw new Error(`clone is at ${head}, expected ${UPSTREAM_COMMIT}`);
    }
    const rulesDirectory = `${clonePath}/packages/eslint-plugin-solid/test/rules`;
    const rules = {};
    for (const file of readdirSync(rulesDirectory)
        .filter((name) => name.endsWith(".test.ts"))
        .sort()) {
        extractFile(rulesDirectory, file, rules);
    }
    const cases = { commit: UPSTREAM_COMMIT, rules, version: UPSTREAM_VERSION };
    writeFileSync(CASES_PATH, `${JSON.stringify(cases, null, 1)}\n`);
    for (const [name, rule] of Object.entries(rules)) {
        console.log(
            `${name}: ${rule.valid.length} valid, ${rule.invalid.length} invalid, ${rule.skipped} skipped`
        );
    }
}

if (import.meta.main) {
    main();
}
