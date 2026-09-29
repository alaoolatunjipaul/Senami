import "@testing-library/jest-dom/vitest";

/**
 * Global test setup.
 *
 * jsdom does not implement these APIs, and several Senami components rely on
 * them (dialogs, scroll locking, clipboard). We provide deterministic
 * polyfills rather than conditionally skipping tests.
 */
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}
