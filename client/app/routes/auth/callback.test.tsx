import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const h = vi.hoisted(() => ({ setAuthenticated: vi.fn() }));
vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({ setAuthenticated: h.setAuthenticated }),
}));
const setAuthenticated = h.setAuthenticated;

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: () => "https://iam.test",
}));

import LoginCallbackPage from "./callback";

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/login/callback${search}`]}>
      <LoginCallbackPage />
    </MemoryRouter>,
  );

describe("LoginCallbackPage (auth/callback)", () => {
  const originalLocation = window.location;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "", origin: "http://localhost" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("renders the loading spinner while the request is in flight", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt("?code=c&state=s");
    expect(screen.getByAltText("Loading")).toBeTruthy();
  });

  it("authenticates and redirects to /console on a successful callback", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    renderAt("?code=abc&state=xyz&tenant_id=t-1");

    await waitFor(() => expect(setAuthenticated).toHaveBeenCalled());
    expect(window.location.href).toBe("/console");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/idp/callback");
    expect(String(url)).toContain("code=abc");
    expect(String(url)).toContain("tenant_id=t-1");
    expect((init as RequestInit).credentials).toBe("include");
    expect((init as { headers: Record<string, string> }).headers["X-Blocks-Key"]).toBe("t-1");
  });

  it("redirects to /login?error=callback_failed when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    renderAt("?code=abc&state=xyz");

    await waitFor(() =>
      expect(window.location.href).toBe("/login?error=callback_failed"),
    );
    expect(setAuthenticated).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=callback_error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    renderAt("?code=abc&state=xyz");

    await waitFor(() =>
      expect(window.location.href).toBe("/login?error=callback_error"),
    );
  });

  it("omits the X-Blocks-Key header when no tenant_id is present", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    renderAt("?code=abc&state=xyz");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(
      (init as { headers: Record<string, string> }).headers["X-Blocks-Key"],
    ).toBeUndefined();
  });
});
