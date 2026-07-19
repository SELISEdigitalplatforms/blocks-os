import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const h = vi.hoisted(() => ({
  isAuthenticated: false,
  navigate: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({ isAuthenticated: h.isAuthenticated }),
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) =>
    ({
      BLOCKS_X_BLOCKS_KEY: "blocks-key",
      BLOCKS_OIDC_CLIENT_ID: "client-id",
      BLOCKS_IAM_BASE_URL: "https://iam.test",
    })[key] ?? "",
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: vi.fn(),
}));

// Replace the heavy animated login page with a minimal control surface.
vi.mock("@/components/blocks-login-page", () => ({
  BlocksLoginPage: ({
    onLogin,
    isLoading,
  }: {
    onLogin: () => void;
    isLoading?: boolean;
  }) => (
    <button type="button" onClick={onLogin} disabled={isLoading}>
      {isLoading ? "Redirecting…" : "Log in"}
    </button>
  ),
}));

import LoginSimplePage from "./login-simple";

describe("LoginSimplePage", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    h.isAuthenticated = false;
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

  it("redirects to /console when already authenticated", () => {
    h.isAuthenticated = true;
    render(<LoginSimplePage />);
    expect(h.navigate).toHaveBeenCalledWith("/console", { replace: true });
  });

  it("renders the login control and does not redirect when unauthenticated", () => {
    render(<LoginSimplePage />);
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("navigates to the authorization URL returned by the initiate endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({ redirect_uri: "https://idp/authorize" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginSimplePage />);
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(window.location.href).toBe("https://idp/authorize"),
    );
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/idp/initiate");
    expect(String(url)).toContain("clientId=client-id");
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when the initiate response has no redirect_uri", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }),
    );

    render(<LoginSimplePage />);
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: "Failed to get authorization URL",
      }),
    );
  });

  it("shows an error toast when the initiate request throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<LoginSimplePage />);
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: "Unable to start login. Please try again.",
      }),
    );
  });
});
