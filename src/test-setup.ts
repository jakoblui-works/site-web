import "@testing-library/jest-dom/vitest";

// jsdom has no `ResizeObserver`, and the home page reads it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Nor `document.fonts`, which the frosted graph waits for before it's drawn. There's no document at all in
// the tests that run in Node (`prerender.test.tsx`).
if (typeof document !== "undefined") {
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() }, configurable: true });
}
