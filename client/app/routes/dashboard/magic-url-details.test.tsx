import { render, screen } from "@testing-library/react";
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
  tenantId: "t-1" as string | undefined,
  magic: {
    data: undefined as Record<string, unknown> | undefined,
    isLoading: false,
    isError: false,
  },
  creator: { data: undefined as { data?: unknown } | undefined },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => h.navigate,
    useParams: () => ({ id: "mu-1" }),
  };
});

vi.mock("@/hooks/use-scoped-path", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));

vi.mock("@blocks-utilities/hooks/use-magic-url", () => ({
  useGetMagicUrlById: () => h.magic,
}));

vi.mock("@blocks-utilities/hooks/use-deactivate-magic-url", () => ({
  useDeactivateMagicUrl: () => ({ deactivateMagicUrl: vi.fn(), isRemoving: false }),
}));

vi.mock("@blocks-utilities/pages/magic-urls/magic-url-status-badge", () => ({
  MagicUrlStatusBadge: () => <span>status-badge</span>,
}));

vi.mock("@/cross-modules/utilities/hooks/use-user-details", () => ({
  useGetCreator: () => h.creator,
}));

vi.mock(
  "@/cross-modules/utilities/components/magic-url-details-skeleton/magic-url-details-skeleton",
  () => ({
    MagicUrlDetailsSkeleton: () => <div>magic url skeleton</div>,
  }),
);

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import MagicUrlDetailsPage from "./magic-url-details";

const renderPage = () =>
  render(
    <MemoryRouter>
      <MagicUrlDetailsPage />
    </MemoryRouter>,
  );

describe("MagicUrlDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tenantId = "t-1";
    h.magic = { data: undefined, isLoading: false, isError: false };
    h.creator = { data: undefined };
  });

  it("renders the skeleton while loading", () => {
    h.magic = { data: undefined, isLoading: true, isError: false };
    renderPage();
    expect(screen.getByText("magic url skeleton")).toBeTruthy();
  });

  it("renders the skeleton when no project/tenant is selected", () => {
    h.tenantId = "";
    renderPage();
    expect(screen.getByText("magic url skeleton")).toBeTruthy();
  });

  it("renders an error message when the query fails", () => {
    h.magic = { data: undefined, isLoading: false, isError: true };
    renderPage();
    expect(screen.getByText("Error loading details")).toBeTruthy();
  });

  it("renders a not-found message when there is no magic url", () => {
    h.magic = { data: undefined, isLoading: false, isError: false };
    renderPage();
    expect(screen.getByText("Details not found")).toBeTruthy();
  });

  it("renders the magic url details when data is present", () => {
    h.magic = {
      data: {
        itemId: "mu-1",
        name: "Welcome Link",
        usageLimit: 10,
        usageCount: 4,
        shortUri: "https://s.test/abc",
        uri: "https://example.test/full",
        createdAt: "2025-01-01T00:00:00Z",
        expiryDate: "",
        createdBy: "user-1",
      },
      isLoading: false,
      isError: false,
    };
    h.creator = { data: { data: { firstName: "Ada", lastName: "Lovelace" } } };

    renderPage();

    expect(screen.getByText("Welcome Link")).toBeTruthy();
    expect(screen.getByText("status-badge")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("https://s.test/abc")).toBeTruthy();
    expect(screen.getByText("https://example.test/full")).toBeTruthy();
    // Usage progress percentage (4/10 = 40%).
    expect(screen.getByText(/40% \(4\/10\)/)).toBeTruthy();
  });
});
