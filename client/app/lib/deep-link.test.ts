import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Menu } from "@/models/menu-models";
import {
  captureDeepLink,
  consumeDeepLink,
  resolveDeepLinkTarget,
  sanitizeDeepLinkPath,
} from "./deep-link";

const at = (pathname: string, search: string) => ({ pathname, search });

describe("sanitizeDeepLinkPath", () => {
  it("keeps a relative in-app path and trims slashes", () => {
    expect(sanitizeDeepLinkPath("secret-management/oidc")).toBe("secret-management/oidc");
    expect(sanitizeDeepLinkPath("/iam/users/")).toBe("iam/users");
  });

  it("reduces a protocol-relative value to a path inside the environment", () => {
    expect(sanitizeDeepLinkPath("//evil.com")).toBe("evil.com");
  });

  it.each([
    [null],
    [""],
    ["/"],
    ["../console"],
    ["iam/../../console"],
    ["https://evil.com"],
    ["iam\\users"],
    ["iam?x=1"],
    ["iam#frag"],
    ["iam/ users"],
  ])("rejects %s", (raw) => {
    expect(sanitizeDeepLinkPath(raw)).toBeNull();
  });
});

describe("captureDeepLink / consumeDeepLink", () => {
  beforeEach(() => sessionStorage.clear());

  it.each(["/", "/login", "/app/console", "/app/console/"])("captures ?path= on %s", (pathname) => {
    captureDeepLink(at(pathname, "?path=secret-management/oidc"));
    expect(consumeDeepLink()).toBe("secret-management/oidc");
  });

  it("ignores other pages and unsafe values", () => {
    captureDeepLink(at("/app/profile", "?path=iam/users"));
    expect(consumeDeepLink()).toBeNull();

    captureDeepLink(at("/login", "?path=https://evil.com"));
    expect(consumeDeepLink()).toBeNull();
  });

  it("is applied once", () => {
    captureDeepLink(at("/login", "?path=iam/users"));
    expect(consumeDeepLink()).toBe("iam/users");
    expect(consumeDeepLink()).toBeNull();
  });
});

describe("resolveDeepLinkTarget", () => {
  const menus: Menu[] = [
    {
      type: "menu",
      id: "secret-management",
      name: "Secret",
      path: "/app/secret-management",
      children: [
        { type: "menu", id: "oidc", name: "OIDC", path: "/app/secret-management/oidc" },
        {
          type: "menu",
          id: "ai-models",
          name: "AI",
          path: "/app/secret-management/ai-models",
          disabled: true,
        },
      ],
    },
    { type: "menu", id: "lmt", name: "LMT", path: "/app/lmt" },
  ];
  const everyRoute = () => true;

  afterEach(() => vi.unstubAllEnvs());

  it("builds the environment path for a known route", () => {
    expect(resolveDeepLinkTarget("env-1", "secret-management/oidc", everyRoute, menus)).toBe(
      "/app/env-1/secret-management/oidc",
    );
  });

  it("returns null when the path is not a route", () => {
    expect(resolveDeepLinkTarget("env-1", "nope", () => false, menus)).toBeNull();
  });

  it("returns null for a disabled menu and anything under it", () => {
    expect(
      resolveDeepLinkTarget("env-1", "secret-management/ai-models", everyRoute, menus),
    ).toBeNull();
    expect(
      resolveDeepLinkTarget("env-1", "secret-management/ai-models/x", everyRoute, menus),
    ).toBeNull();
  });

  it("returns null for a menu blocked by BLOCKS_BLOCKED_MENU", () => {
    vi.stubEnv("BLOCKS_BLOCKED_MENU", '["lmt"]');
    expect(resolveDeepLinkTarget("env-1", "lmt/logs", everyRoute, menus)).toBeNull();
    expect(resolveDeepLinkTarget("env-1", "secret-management/oidc", everyRoute, menus)).toBe(
      "/app/env-1/secret-management/oidc",
    );
  });

  it("does not treat a shared prefix as a parent", () => {
    vi.stubEnv("BLOCKS_BLOCKED_MENU", '["lmt"]');
    expect(resolveDeepLinkTarget("env-1", "lmtx", everyRoute, menus)).toBe("/app/env-1/lmtx");
  });
});
