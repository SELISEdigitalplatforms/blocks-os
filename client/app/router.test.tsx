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
