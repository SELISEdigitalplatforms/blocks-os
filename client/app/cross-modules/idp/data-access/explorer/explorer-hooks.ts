import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";

/** Selected service filter and schema, kept in the URL so links and Back work (as in the Data Gateway). */
export function useDataAccessSearchParams() {
  return useQueryStates(
    {
      service: parseAsString.withDefault("all"),
      schemaId: parseAsString,
    },
    { clearOnDefault: false },
  );
}

/**
 * Holds on to the last non-null value for `delay` ms after it clears, so a docked
 * panel stays drawn while its column collapses (same as the Data Gateway's hook).
 */
export function useLingeringValue<T>(value: T | null, delay: number): T | null {
  const [lingering, setLingering] = useState<T | null>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (value !== null && value !== lingering) {
    setLingering(value);
  }

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (value !== null) return;
    timeoutRef.current = setTimeout(() => setLingering(null), delay);
    return () => clearTimeout(timeoutRef.current);
  }, [value, delay]);

  return value ?? lingering;
}

const LARGE_SCREEN_QUERY = "(min-width: 1024px)";

/** True at Tailwind's `lg` and up, where the inspector docks beside the table instead of opening as a sheet. */
export function useIsLargeScreen() {
  const [isLarge, setIsLarge] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia(LARGE_SCREEN_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(LARGE_SCREEN_QUERY);
    const onChange = () => setIsLarge(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isLarge;
}

// The "Default Properties" group is open or closed for every table on the page at once.
let sharedDefaultsExpanded = false;
const defaultsListeners = new Set<(value: boolean) => void>();

export function useDefaultPropertiesExpanded() {
  const [isExpanded, setIsExpanded] = useState(sharedDefaultsExpanded);

  useEffect(() => {
    const listener = (value: boolean) => setIsExpanded(value);
    defaultsListeners.add(listener);
    return () => {
      defaultsListeners.delete(listener);
    };
  }, []);

  const setExpanded = (value: boolean) => {
    sharedDefaultsExpanded = value;
    defaultsListeners.forEach((listener) => listener(value));
  };

  return [isExpanded, setExpanded] as const;
}
