// The directive exempts one function only. The sibling below has none and must
// still be reported by both async rules: exactly two diagnostics for this file.

declare function readTodos(): Promise<string[]>;

export async function listTodos(): Promise<string[]> {
  "use server";
  return readTodos();
}

export async function countTodos(): Promise<number> {
  const todos = await readTodos();
  return todos.length;
}
