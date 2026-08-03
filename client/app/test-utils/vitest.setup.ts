/**
 * Global vitest setup for the jsdom environment.
 *
 * Under the current toolchain (vitest 4 + jsdom 29 on a recent Node), jsdom
 * does not expose `localStorage`/`sessionStorage` (opaque origin) and never
 * ships `matchMedia`, `ResizeObserver`, or `IntersectionObserver`. A large
 * share of the suite assumes these browser globals exist, so we polyfill the
 * missing ones here — only when absent, so real browser-like environments and
 * per-test overrides keep working.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function ensureStorage(name: "localStorage" | "sessionStorage"): void {
  let usable = false;
  try {
    const existing = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
    if (existing) {
      existing.setItem("__probe__", "1");
      existing.removeItem("__probe__");
      usable = true;
    }
  } catch {
    usable = false;
  }

  if (!usable) {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, {
      value: storage,
      writable: true,
      configurable: true,
    });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, name, {
        value: storage,
        writable: true,
        configurable: true,
      });
    }
  }
}

ensureStorage("localStorage");
ensureStorage("sessionStorage");

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as Record<string, unknown>).IntersectionObserver = IntersectionObserverStub;
}

if (typeof window !== "undefined" && typeof window.scrollTo !== "function") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    configurable: true,
    value: () => {},
  });
}

// Radix UI primitives (Select, Dropdown, etc.) call these DOM APIs that jsdom
// does not implement. Define no-op stubs only when they are missing so that
// components using those primitives can be exercised under jsdom.
if (typeof Element !== "undefined") {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.scrollIntoView !== "function") {
    proto.scrollIntoView = function scrollIntoView(): void {};
  }
  if (typeof proto.scrollTo !== "function") {
    proto.scrollTo = function scrollTo(): void {};
  }
  if (typeof proto.hasPointerCapture !== "function") {
    proto.hasPointerCapture = function hasPointerCapture(): boolean {
      return false;
    };
  }
  if (typeof proto.setPointerCapture !== "function") {
    proto.setPointerCapture = function setPointerCapture(): void {};
  }
  if (typeof proto.releasePointerCapture !== "function") {
    proto.releasePointerCapture = function releasePointerCapture(): void {};
  }
}

// jsdom does not implement hit testing, so `document.elementFromPoint` is
// missing. Some Radix primitives call it asynchronously after interaction,
// which surfaces as an uncaught error that fails an otherwise passing run.
// Provide inert stubs only when they are absent.
if (typeof document !== "undefined") {
  const doc = document as unknown as {
    elementFromPoint?: unknown;
    elementsFromPoint?: unknown;
  };
  if (typeof doc.elementFromPoint !== "function") {
    doc.elementFromPoint = (): Element | null => null;
  }
  if (typeof doc.elementsFromPoint !== "function") {
    doc.elementsFromPoint = (): Element[] => [];
  }
}
