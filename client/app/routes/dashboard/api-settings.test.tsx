import { render, screen } from "@testing-library/react";
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
  endpoints: {
    data: undefined as { pages: Array<{ data: unknown[] }> } | undefined,
    isLoading: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  },
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t-1" } }),
}));

vi.mock("@blocks-idp/api-settings/hooks/use-api-settings", () => ({
  useGetApiEndpointsInfinite: () => h.endpoints,
  useUpdateApiEndpoint: () => ({ mutateAsync: vi.fn() }),
  useBulkUpdateApiEndpoints: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@blocks-idp/api-settings/components/service-group-card", () => ({
  ServiceGroupCard: ({ controller }: { controller: string }) => (
    <div data-testid="service-group-card">{controller}</div>
  ),
}));

vi.mock("@blocks-idp/api-settings/components/bulk-action-bar", () => ({
  BulkActionBar: ({ selectedCount }: { selectedCount: number }) => (
    <div data-testid="bulk-bar">selected:{selectedCount}</div>
  ),
}));

vi.mock("@blocks-idp/api-settings/utils/service-swagger", () => ({
  getServiceSwaggerUrl: () => "",
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

import ApiSettingsPage from "./api-settings";

const endpoint = (over: Record<string, unknown>) => ({
  itemId: "id",
  service: "iam",
  controller: "auth",
  method: "post",
  description: "",
  isMFARequired: false,
  isCaptchaRequired: false,
  mfaType: "",
  captchaProvider: "",
  baseUrl: "https://api.test",
  ...over,
});

describe("ApiSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.endpoints = {
      data: undefined,
      isLoading: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    };
  });

  it("always renders the page heading", () => {
    h.endpoints.isLoading = true;
    render(<ApiSettingsPage />);
    expect(screen.getByText("API Settings")).toBeTruthy();
    // No empty-state or grouped content while loading.
    expect(screen.queryByText("No API endpoints configured.")).toBeNull();
    expect(screen.queryByTestId("service-group-card")).toBeNull();
  });

  it("shows the empty state when there are no endpoints", () => {
    h.endpoints.data = { pages: [{ data: [] }] };
    render(<ApiSettingsPage />);
    expect(screen.getByText("No API endpoints configured.")).toBeTruthy();
  });

  it("groups endpoints by service and renders a card per controller", () => {
    h.endpoints.data = {
      pages: [
        {
          data: [
            endpoint({ itemId: "1", service: "iam", controller: "auth" }),
            endpoint({ itemId: "2", service: "storage", controller: "files", method: "get" }),
          ],
        },
      ],
    };
    render(<ApiSettingsPage />);

    // Service headings (sorted alphabetically).
    expect(screen.getByText("iam")).toBeTruthy();
    expect(screen.getByText("storage")).toBeTruthy();
    // A ServiceGroupCard per controller.
    const cards = screen.getAllByTestId("service-group-card");
    expect(cards.map((c) => c.textContent).sort()).toEqual(["auth", "files"]);
  });
});
