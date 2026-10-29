import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isLoading: false,
  isFetching: false,
  data: undefined as unknown,
  useFindSecrets: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useGetAuthOidcCredentials: () => ({
    isLoading: h.isLoading,
    isFetching: h.isFetching,
    data: h.data,
  }),
}));
vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useFindSecrets: h.useFindSecrets,
}));
// Isolate the row from its own data-fetching so the list logic is under test.
vi.mock("./oidc-card", () => ({
  OIDCRowExport: ({
    item,
    loginPolicy,
  }: {
    item: { itemId: string; clientId?: string };
    loginPolicy?: { method: string };
  }) => (
    <tr data-testid="oidc-row" data-policy={loginPolicy?.method ?? "none"}>
      <td>{item.clientId ?? item.itemId}</td>
    </tr>
  ),
}));

import { OidcList } from "./oidc-list";

const OLDER = "2024-01-01";

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
    expect(
      container.querySelectorAll(".animate-pulse, [class*='skeleton']").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Client")).toBeNull();
  });

  it("keeps the rows mounted while refetching, so an open row dialog survives", () => {
    h.isFetching = true;
    h.data = {
      oIDCClientCredentials: [{ itemId: "1", clientId: "kept", createdDate: OLDER }],
    };
    render(<OidcList />);
    expect(screen.getByText("Client")).toBeTruthy();
    expect(screen.getByText("kept")).toBeTruthy();
  });

  it("shows the empty state when there are no credentials", () => {
    h.data = { oIDCClientCredentials: [] };
    render(<OidcList />);
    expect(screen.getByText("No OIDC clients yet")).toBeTruthy();
    expect(h.useFindSecrets).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 10 }, true);
  });

  it("normalises a single credential object into a table row", () => {
    h.data = {
      oIDCClientCredentials: { itemId: "1", clientId: "single", createdDate: OLDER },
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

  it("passes each client its own sign-in policy from the list response", () => {
    h.data = {
      oIDCClientCredentials: [
        { itemId: "1", createdDate: "2024-01-02" },
        { itemId: "2", createdDate: OLDER },
      ],
      loginPolicies: { "1": { method: "social", providers: "default", selectedProviderIds: [] } },
    };
    render(<OidcList />);
    expect(screen.getAllByTestId("oidc-row").map((row) => row.dataset.policy)).toEqual([
      "social",
      "none",
    ]);
  });
});
