import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ getRoles: vi.fn(), getUsers: vi.fn() }));
vi.mock("@blocks-idp/iam/services/role.service", () => ({ roleService: { getRoles: h.getRoles } }));
vi.mock("@blocks-idp/iam/services/user.service", () => ({ userService: { getUsers: h.getUsers, getUserById: vi.fn() } }));

import { PrincipalSelector } from "./principal-selector";

function renderSelector(props: Partial<Parameters<typeof PrincipalSelector>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PrincipalSelector entity="role" projectKey="tenant-1" value="" onChange={onChange} multiple variant="chip" {...props} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe("PrincipalSelector", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    h.getRoles.mockReset().mockResolvedValue({ data: [{ slug: "admin", name: "Admin" }], totalCount: 1 });
    h.getUsers.mockReset().mockResolvedValue({
      data: [{ itemId: "u1", firstName: "Ann", lastName: "Lee", email: "ann@x.io" }],
      totalCount: 1,
    });
  });

  it("opens the role list from the Not set chip and picks a role", async () => {
    const user = userEvent.setup();
    const onChange = renderSelector();

    await user.click(screen.getByRole("button", { name: "Select role" }));
    await user.click(await screen.findByText("Admin"));

    expect(h.getRoles).toHaveBeenCalledWith(expect.objectContaining({ projectKey: "tenant-1", page: 0 }));
    expect(onChange).toHaveBeenCalledWith("admin");
  });

  it("opens the user list and stores the user's id", async () => {
    const user = userEvent.setup();
    const onChange = renderSelector({ entity: "user", userValueField: "itemId" });

    await user.click(screen.getByRole("button", { name: "Select user" }));
    await user.click(await screen.findByText("Ann Lee"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("u1"));
  });

  it("loads nothing until the list is opened", () => {
    renderSelector();
    expect(h.getRoles).not.toHaveBeenCalled();
  });
});
