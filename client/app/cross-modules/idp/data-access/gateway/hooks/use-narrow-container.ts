import { useEffect, useState } from "react";

/**
 * Whether the ref'd element's own rendered width has dropped below
 * `threshold`, tracked via ResizeObserver.
 *
 * Not a viewport media query: the schema detail header narrows because the
 * access inspector opens beside it, not because the browser window shrinks,
 * so `window.resize`/Tailwind breakpoints can't see it — only the element's
 * own box can.
 *
 * `ref` is a callback ref, not a ref object: the element may mount after the
 * component does (e.g. once a loading skeleton gives way to the real header),
 * and a ref object read once on mount would never see it.
 */
export function useNarrowContainer<T extends HTMLElement>(threshold: number) {
  const [element, setElement] = useState<T | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setIsNarrow(entry.contentRect.width < threshold);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, threshold]);

  return { ref: setElement, isNarrow };
}

