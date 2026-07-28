import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: [{ itemId: "c1" }] as unknown,
  isLoading: false,
  isFetching: false,
  setOpen: vi.fn(),
  setItemId: vi.fn(),
  listProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-clients", () => ({
  useListAuthClientCredentials: () => ({
    data: h.data,
    isLoading: h.isLoading,
    isFetching: h.isFetching,
  }),
}));
vi.mock("./client-credentials-list", () => ({
  ClientCredentialList: (props: Record<string, unknown>) => {
    h.listProps = props;
    const data = props.data as unknown[];
    return <div data-testid="list">count:{data.length}</div>;
  },
}));
vi.mock("nuqs", () => ({
  parseAsBoolean: { withDefault: () => ({}) },
  parseAsString: { withDefault: () => ({}) },
  useQueryState: (key: string) => [null, key === "clientCredentialOpen" ? h.setOpen : h.setItemId],
}));

import { ClientCredentials } from "./client-credentials";

describe("ClientCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.data = [{ itemId: "c1" }];
    h.isLoading = false;
    h.isFetching = false;
  });

  it("renders the credential list with the fetched data", () => {
    render(<ClientCredentials />);
    expect(screen.getByTestId("list").textContent).toBe("count:1");
  });

  it("opens the editor with the selected client id", () => {
    render(<ClientCredentials />);
    const onEdit = h.listProps?.onEdit as (c: { itemId: string } | null) => void;
    onEdit({ itemId: "c1" });
    expect(h.setItemId).toHaveBeenCalledWith("c1");
    expect(h.setOpen).toHaveBeenCalledWith(true);
  });

  it("clears the id when opening the editor with no client", () => {
    render(<ClientCredentials />);
    const onEdit = h.listProps?.onEdit as (c: { itemId: string } | null) => void;
    onEdit(null);
    expect(h.setItemId).toHaveBeenCalledWith("");
    expect(h.setOpen).toHaveBeenCalledWith(true);
  });

  it("passes an empty list through when there is no data", () => {
    h.data = undefined;
    render(<ClientCredentials />);
    expect(screen.getByTestId("list").textContent).toBe("count:0");
  });
});
