import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({ isAuthenticated: h.isAuthenticated }),
}));

import { PublicGuard } from "./public-guard";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PublicGuard>
        <div>public content</div>
      </PublicGuard>
    </MemoryRouter>,
  );

describe("PublicGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isAuthenticated = false;
  });

  it("renders children for an unauthenticated visitor", async () => {
    renderAt("/login");
    await waitFor(() => expect(screen.getByText("public content")).toBeTruthy());
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("redirects an authenticated visitor to /console", async () => {
    h.isAuthenticated = true;
    renderAt("/login");
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith("/console", { replace: true }),
    );
    expect(screen.queryByText("public content")).toBeNull();
  });

  it("does not redirect during an in-progress SSO callback (code + state present)", async () => {
    h.isAuthenticated = true;
    renderAt("/login?code=abc&state=xyz");
    await waitFor(() => expect(screen.getByText("public content")).toBeTruthy());
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
