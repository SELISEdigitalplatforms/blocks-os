import { navigationMenus } from "@/constants/navigation-menus";
import type { Menu } from "@/models/menu-models";

/**
 * A `?path=` given on `/`, `/login` or `/app/console` is held here until the user opens an
 * environment, then applied inside it: `/app/<itemId>/<path>`. sessionStorage because the OIDC
 * round trip leaves the origin, and every guard on the way drops the query string.
 */
const STORAGE_KEY = "blocks:deep-link-path";
const CAPTURE_PATHS = new Set(["/", "/login", "/app/console"]);
const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

/** A relative in-app path, or null. Anything that could leave the environment is rejected. */
export const sanitizeDeepLinkPath = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const path = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!path) return null;
  const segments = path.split("/");
  return segments.every((s) => SEGMENT.test(s) && s !== "." && s !== "..") ? path : null;
};

const safeStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const captureDeepLink = (location: Pick<Location, "pathname" | "search">): void => {
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  if (!CAPTURE_PATHS.has(pathname)) return;
  const path = sanitizeDeepLinkPath(new URLSearchParams(location.search).get("path"));
  if (path) safeStorage()?.setItem(STORAGE_KEY, path);
};

/** Reads and forgets the pending path, so it is applied to one environment only. */
export const consumeDeepLink = (): string | null => {
  const storage = safeStorage();
  const path = storage?.getItem(STORAGE_KEY) ?? null;
  storage?.removeItem(STORAGE_KEY);
  return sanitizeDeepLinkPath(path);
};

const blockedMenuIds = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(import.meta.env.BLOCKS_BLOCKED_MENU || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/** Environment-relative paths of menus the sidebar hides, so a link cannot reach them either. */
const hiddenMenuPaths = (menus: Menu[], blocked: string[], parentHidden = false): string[] =>
  menus.flatMap((menu) => {
    if (menu.type !== "menu") return [];
    const hidden = parentHidden || !!menu.disabled || blocked.includes(menu.id);
    const own = hidden ? [menu.path.replace(/^\/app\//, "")] : [];
    return [...own, ...hiddenMenuPaths(menu.children ?? [], blocked, hidden)];
  });

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Where the pending path leads inside this environment, or null to stay on the default page:
 * when it is not a route of the environment (`isRoute` is false) or its menu is hidden.
 */
export const resolveDeepLinkTarget = (
  itemId: string,
  path: string,
  isRoute: (pathname: string) => boolean,
  menus: Menu[] = navigationMenus,
): string | null => {
  const target = `/app/${itemId}/${path}`;
  if (!isRoute(target)) return null;
  const hidden = hiddenMenuPaths(menus, blockedMenuIds());
  return hidden.some((prefix) => isUnder(path, prefix)) ? null : target;
};
