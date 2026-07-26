import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isLoading: false,
  isFetching: false,
  data: undefined as unknown,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useGetAuthOidcCredentials: () => ({
    isLoading: h.isLoading,
    isFetching: h.isFetching,
    data: h.data,
  }),
}));
// Isolate the row from its own data-fetching so the list logic is under test.
vi.mock("./oidc-card", () => ({
  OIDCRowExport: ({ item }: { item: { itemId: string; clientId?: string } }) => (
    <tr data-testid="oidc-row">
      <td>{item.clientId ?? item.itemId}</td>
    </tr>
  ),
}));

import { OidcList } from "./oidc-list";

describe("OidcList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.data = undefined;
  });

  it("renders the skeleton while loading", () => {
    h.isLoading = true;
    const { container } = render(<OidcList />);
    expect(container.querySelectorAll(".animate-pulse, [class*='skeleton']").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Client")).toBeNull();
  });

  it("renders the skeleton while refetching", () => {
    h.isFetching = true;
    render(<OidcList />);
    expect(screen.queryByText("Client")).toBeNull();
  });

  it("shows the empty state when there are no credentials", () => {
    h.data = { oIDCClientCredentials: [] };
    render(<OidcList />);
    expect(screen.getByText("No OIDC clients yet")).toBeTruthy();
  });

  it("normalises a single credential object into a table row", () => {
    h.data = {
      oIDCClientCredentials: { itemId: "1", clientId: "single", createdDate: "2024-01-01" },
    };
    render(<OidcList />);
    expect(screen.getByText("Client")).toBeTruthy();
    expect(screen.getByText("single")).toBeTruthy();
  });

  it("sorts multiple credentials by newest created date first", () => {
    h.data = {
      oIDCClientCredentials: [
        { itemId: "1", clientId: "older", createdDate: "2023-01-01" },
        { itemId: "2", clientId: "newer", createdDate: "2024-06-01" },
      ],
    };
    render(<OidcList />);
    const rows = screen.getAllByTestId("oidc-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe("newer");
    expect(rows[1].textContent).toBe("older");
  });
});
