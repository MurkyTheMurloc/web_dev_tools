// This file is intentionally valid. A function whose body starts with
// `"use server"` is server code even in a normal module; the async typebuddy
// rules leave it, and the callbacks inside it, alone.

declare function readTodos(): Promise<string[]>;

export async function listTodos(): Promise<string[]> {
  "use server";
  const todos = await readTodos();
  const titles = todos.map(async (todo): Promise<string> => todo);
  return (await Promise.all(titles)).concat(todos);
}
