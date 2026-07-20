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
  navigate: vi.fn(),
  setUser: vi.fn(),
  me: undefined as { data: unknown } | undefined,
  impersonation: {
    data: undefined as unknown,
    isLoading: false,
    isSuccess: true,
  },
  store: {
    setImpersonation: vi.fn(),
    isInitialized: true,
    setInitialized: vi.fn(),
    isImpersonated: false,
    impersonatedTenantId: null as string | null,
    terminate: vi.fn(),
    impersonate: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({ setUser: h.setUser }),
}));

vi.mock("@/idp/iam/hooks/use-user", () => ({
  useGetMe: () => ({ data: h.me }),
}));

// The guard's redirect effect omits isMounted from its dependency list, so it
// only runs the redirect/setUser logic when isMounted is already true on the
// first render. Force that here for deterministic behaviour.
vi.mock("./public-guard", () => ({
  useAppState: () => ({ isMounted: true }),
}));

vi.mock("@/hooks/use-impersonation", () => ({
  useImpersonationStatusChecker: () => h.impersonation,
  useStartImpersonation: () => ({ mutateAsync: vi.fn() }),
  useStopImpersonation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/store/impersonate-store", () => ({
  useImpersonateStore: Object.assign(() => h.store, { getState: () => h.store }),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t-1" } }),
}));

vi.mock("@/services/impersonation.service", () => ({}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: () => "blocks-key",
}));

import { ProtectedGuard, ImpersonationChecker } from "./protected-guard";

const renderGuard = () =>
  render(
    <MemoryRouter>
      <ProtectedGuard>
        <div>secure area</div>
      </ProtectedGuard>
    </MemoryRouter>,
  );

describe("ProtectedGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.me = undefined;
  });

  it("redirects to /login when there is no authenticated user", async () => {
    h.me = undefined;
    renderGuard();
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith("/login", { replace: true }),
    );
    expect(screen.queryByText("secure area")).toBeNull();
  });

  it("stores the user and renders children when authenticated", async () => {
    const user = { itemId: "u-1", firstName: "Ada" };
    h.me = { data: user };
    renderGuard();

    await waitFor(() => expect(screen.getByText("secure area")).toBeTruthy());
    expect(h.setUser).toHaveBeenCalledWith(user);
    expect(h.navigate).not.toHaveBeenCalled();
  });
});

describe("ImpersonationChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.impersonation = { data: undefined, isLoading: false, isSuccess: true };
    h.store.isInitialized = true;
  });

  it("shows a loading spinner while the impersonation status is loading", () => {
    h.impersonation = { data: undefined, isLoading: true, isSuccess: false };
    render(
      <ImpersonationChecker>
        <div>impersonation child</div>
      </ImpersonationChecker>,
    );
    expect(screen.getByAltText("Loading")).toBeTruthy();
    expect(screen.queryByText("impersonation child")).toBeNull();
  });

  it("renders children once the status is initialized and successful", async () => {
    h.impersonation = {
      data: {
        impersonated: false,
        originalTenantId: "orig",
        impersonatedTenantId: null,
      },
      isLoading: false,
      isSuccess: true,
    };
    render(
      <ImpersonationChecker>
        <div>impersonation child</div>
      </ImpersonationChecker>,
    );
    await waitFor(() =>
      expect(screen.getByText("impersonation child")).toBeTruthy(),
    );
    expect(h.store.setImpersonation).toHaveBeenCalled();
  });
});
