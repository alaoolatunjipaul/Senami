import "@testing-library/jest-dom/vitest";

/**
 * Global test setup.
 *
 * jsdom implements only a subset of the browser platform. Radix primitives rely
 * on a handful of APIs for measurement and pointer capture, and Senami's
 * components rely on `matchMedia` and `scrollIntoView`. We provide
 * deterministic polyfills here rather than skipping the tests that need them.
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

  // Radix's popper-based primitives (dropdown, tooltip, select) measure their
  // trigger and call these during layout.
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
  }

  if (typeof globalThis.DOMRect === "undefined") {
    globalThis.DOMRect = class DOMRect {
      constructor(
        public x = 0,
        public y = 0,
        public width = 0,
        public height = 0,
      ) {}
      get top() {
        return this.y;
      }
      get left() {
        return this.x;
      }
      get right() {
        return this.x + this.width;
      }
      get bottom() {
        return this.y + this.height;
      }
      toJSON() {
        return this;
      }
      static fromRect() {
        return new globalThis.DOMRect();
      }
    } as unknown as typeof DOMRect;
  }
}
