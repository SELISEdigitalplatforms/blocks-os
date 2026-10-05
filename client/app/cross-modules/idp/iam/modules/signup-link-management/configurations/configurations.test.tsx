import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryResult: {
    data: { items: [], totalCount: 0 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetched: true,
  },
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, search: "", includeInactive: false },
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useGetSignupLinkConfigurations: () => h.queryResult,
}));

vi.mock("./configurations-filter-toolbar", () => ({
  useSignupLinkConfigurationsQueryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
  ConfigurationsFilterToolbar: () => <div data-testid="filter-toolbar" />,
}));

vi.mock("./configurations-list", () => ({
  ConfigurationsList: (props: {
    isForbidden: boolean;
    isError: boolean;
    isLoading: boolean;
    onRetry: () => void;
  }) => (
    <div>
      <span data-testid="forbidden">{String(props.isForbidden)}</span>
      <span data-testid="error">{String(props.isError)}</span>
      <span data-testid="loading">{String(props.isLoading)}</span>
      <button type="button" onClick={props.onRetry}>
        Retry
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({ onChange }: { onChange: (p: number) => void }) => (
    <button type="button" onClick={() => onChange(1)}>
      Next page
    </button>
  ),
}));

import { SignupLinkConfigurations } from "./configurations";

describe("SignupLinkConfigurations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queryResult = {
      data: { items: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetched: true,
    };
    h.queryParams = { page: 0, pageSize: 10, search: "", includeInactive: false };
  });

  it("marks forbidden when the query errors with 403", () => {
    h.queryResult.isError = true;
    h.queryResult.error = { status: 403 };
    render(<SignupLinkConfigurations />);
    expect(screen.getByTestId("forbidden").textContent).toBe("true");
    expect(screen.queryByTestId("filter-toolbar")).toBeNull();
  });

  it("renders pagination when totalCount exceeds pageSize", async () => {
    h.queryResult.data = {
      items: Array.from({ length: 10 }, (_, i) => ({ itemId: String(i) })),
      totalCount: 25,
    } as never;
    const user = userEvent.setup();
    render(<SignupLinkConfigurations />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(h.setQueryParams).toHaveBeenCalled();
  });

  it("retries on error", async () => {
    h.queryResult.isError = true;
    h.queryResult.error = { status: 500 };
    const user = userEvent.setup();
    render(<SignupLinkConfigurations />);
    expect(screen.getByTestId("error").textContent).toBe("true");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.queryResult.refetch).toHaveBeenCalled();
  });
});
