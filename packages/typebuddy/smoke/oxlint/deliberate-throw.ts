// This file is intentionally valid. A function that throws has decided its
// failure is a broken invariant rather than a value to hand back, so neither
// `require-try-catch` nor `prefer-maybe-promise` should touch it.

declare const manifests: Record<string, () => Promise<{ default: string }>>;

export async function loadManifest(route: string): Promise<string> {
  const loader = manifests[route];
  if (loader === undefined) {
    // A missing manifest for a route being navigated to is a broken build.
    // Returning err() here would degrade politely and hide it.
    throw new Error(`Manifest missing for route:${route}`);
  }

  const module = await loader();
  return module.default;
}

// A rethrow inside catch is just as deliberate.
export async function readStrict(path: string): Promise<string> {
  try {
    const module = await manifests[path]?.();
    return module?.default ?? "";
  } catch (error) {
    throw new Error(`Unreadable: ${path}`, { cause: error });
  }
}
