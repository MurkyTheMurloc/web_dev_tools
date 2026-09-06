type AstNode = {
  type: string;
  parent?: AstNode;
  [key: string]: unknown;
};

const PACKAGE_NAME = "@murky-web/typebuddy";

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function isIdentifierNamed(node: unknown, name: string): boolean {
  return isNode(node) && node.type === "Identifier" && node["name"] === name;
}

function isImportDeclaration(node: unknown): node is AstNode {
  return isNode(node) && node.type === "ImportDeclaration";
}

function getStringLiteralValue(node: unknown): string | null {
  if (!isNode(node)) {
    return null;
  }

  if (
    (node.type === "Literal" || node.type === "StringLiteral") &&
    typeof node["value"] === "string"
  ) {
    return node["value"];
  }

  return null;
}

function getProgram(node: unknown): AstNode | null {
  if (!isNode(node)) {
    return null;
  }

  let current: AstNode | undefined = node;
  while (current?.parent) {
    current = current.parent;
  }

  return current?.type === "Program" ? current : null;
}

function getProgramBody(program: AstNode): AstNode[] {
  if (!Array.isArray(program["body"])) {
    return [];
  }

  return program["body"].filter(isNode);
}

function importsHelper(program: AstNode, helperName: string): boolean {
  return getProgramBody(program).some((statement) => {
    if (!isImportDeclaration(statement)) {
      return false;
    }

    if (getStringLiteralValue(statement["source"]) !== PACKAGE_NAME) {
      return false;
    }

    // A type-only import brings no runtime binding, so it does not satisfy a
    // fix that is about to call the helper.
    if (statement["importKind"] === "type") {
      return false;
    }

    const specifiers = Array.isArray(statement["specifiers"])
      ? statement["specifiers"]
      : [];

    return specifiers.some((specifier) => {
      return (
        isNode(specifier) &&
        specifier.type === "ImportSpecifier" &&
        isIdentifierNamed(specifier["local"], helperName)
      );
    });
  });
}

/**
 * Where and what to insert so `helperName` is imported from the package.
 *
 * Both async rules add `ok`/`err` imports, and both used to carry their own
 * copy of this — including the same bug. Whether the import lands after an
 * existing one was inferred from the anchor's offset (`range[0] !== 0`), which
 * is only the same question in a file whose first statement starts at byte
 * zero. A leading comment moved the first statement off zero, the wrong branch
 * won, and the fix emitted a leading newline instead of a trailing one:
 *
 *     import { err } from "@murky-web/typebuddy";export async function load()
 *
 * The list of imports answers it directly, so that is what decides now.
 *
 * @param {unknown} node - Any node in the file; the program is found from it.
 * @param {string} helperName - The named export to import, e.g. `"err"`.
 * @returns {{ range: [number, number]; text: string } | null} The zero-width
 *   insertion to apply, or null when the helper is already imported or no
 *   anchor carries a usable range.
 */
function getTypeBuddyImportInsertion(
  node: unknown,
  helperName: string,
): { range: [number, number]; text: string } | null {
  const program = getProgram(node);
  if (!program || importsHelper(program, helperName)) {
    return null;
  }

  const body = getProgramBody(program);
  const imports = body.filter(isImportDeclaration);
  const anchor = imports.at(-1) ?? body[0] ?? program;
  const range = anchor["range"];
  if (!Array.isArray(range) || range.length < 2) {
    return null;
  }

  const statement = `import { ${helperName} } from "${PACKAGE_NAME}";`;
  if (imports.length > 0) {
    const end: number = range[1];
    return { range: [end, end], text: `\n${statement}` };
  }

  const start: number = range[0];
  return { range: [start, start], text: `${statement}\n` };
}

export { getTypeBuddyImportInsertion };
