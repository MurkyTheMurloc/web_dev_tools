"use server";

// This file is intentionally valid. Functions in a `"use server"` module log and
// throw on failure and the page catches the throw with `<Errored>`, so neither
// `require-try-catch` nor `prefer-maybe-promise` should touch it.

declare function readTodos(): Promise<string[]>;

export async function listTodos(): Promise<string[]> {
  return readTodos();
}

export async function countTodos(): Promise<number> {
  const todos = await readTodos();
  return todos.length;
}
