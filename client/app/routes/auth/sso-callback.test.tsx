import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@seliseblocks/blocks-kit/store", () => ({
  useAuthStore: () => ({ setAuthenticated: h.setAuthenticated }),
}));
const setAuthenticated = h.setAuthenticated;

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: () => "https://iam.test",
}));

import SsoCallbackPage from "./sso-callback";

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/sso/callback${search}`]}>
      <SsoCallbackPage />
    </MemoryRouter>,
  );

describe("SsoCallbackPage (auth/sso-callback)", () => {
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

  it("calls the OIDC callback endpoint, authenticates and redirects on success", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    renderAt("?code=abc&state=xyz&tenant_id=t-9");

    await waitFor(() => expect(setAuthenticated).toHaveBeenCalled());
    expect(window.location.href).toBe("/console");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/oidc/oidc/callback");
    expect(String(url)).toContain("code=abc");
    expect((init as { headers: Record<string, string> }).headers["X-Blocks-Key"]).toBe("t-9");
  });

  it("redirects to callback_failed when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    renderAt("?code=abc&state=xyz");

    await waitFor(() =>
      expect(window.location.href).toBe("/login?error=callback_failed"),
    );
    expect(setAuthenticated).not.toHaveBeenCalled();
  });

  it("redirects to callback_error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    renderAt("?code=abc&state=xyz");

    await waitFor(() =>
      expect(window.location.href).toBe("/login?error=callback_error"),
    );
  });
});
