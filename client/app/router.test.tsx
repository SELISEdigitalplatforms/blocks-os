import { describe, expect, it } from "vitest";
import { matchRoutes, type RouteObject } from "react-router";
import { OIDC_BRANDING_ROUTE_PATH } from "@/routes/oidc-branding-route";

const routes: RouteObject[] = [
  {
    path: "oidc",
    children: [{ index: true }, { path: OIDC_BRANDING_ROUTE_PATH }],
  },
];

describe("OIDC branding routes", () => {
  it("resolves the tenant-level branding URL", () => {
    const matches = matchRoutes(routes, "/oidc/branding");
    expect(matches?.at(-1)?.route.path).toBe("branding");
  });

  it("does not resolve the retired per-client branding URL", () => {
    expect(matchRoutes(routes, "/oidc/client-1/branding")).toBeNull();
  });
});

describe("organization disabled gate placement", () => {
  type RouteNode = { path?: string; element?: unknown; children?: RouteNode[] };

  // Walks a React element tree for the gate component without rendering it.
  const containsGate = (node: unknown, gate: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    if (Array.isArray(node)) return node.some((child) => containsGate(child, gate));
    const element = node as { type?: unknown; props?: { children?: unknown } };
    return element.type === gate || containsGate(element.props?.children, gate);
  };

  const flatten = (routes: RouteNode[]): RouteNode[] =>
    routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);

  it("wraps only the /app content, so public routes never request auth/me (C11)", async () => {
    const [{ router }, { OrganizationDisabledGate }] = await Promise.all([
      import("@/router"),
      import("@/components/organization-disabled-gate"),
    ]);
    const routes = flatten(router.routes as RouteNode[]);
    const withGate = routes.filter((route) =>
      containsGate(route.element, OrganizationDisabledGate),
    );

    expect(withGate.map((route) => route.path)).toEqual(["/app"]);
    for (const path of ["/login", "/login/callback", "/activate", "/invitation", "/connect"]) {
      expect(routes.some((route) => route.path === path)).toBe(true);
    }
  }, 60_000);
});
