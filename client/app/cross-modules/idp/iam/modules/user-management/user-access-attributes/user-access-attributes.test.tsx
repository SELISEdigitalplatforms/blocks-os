import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isRestricted: false,
  authUser: { sub: "caller", org_id: "org-1" } as { sub: string; org_id: string } | null,
  users: {} as Record<string, unknown>,
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: h.authUser }),
}));
vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => ({
  useGrantScope: () => ({ isRestricted: h.isRestricted }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: ({ id }: { id: string }) => ({ data: { data: h.users[id] } }),
  useUpdateUser: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { UserAccessAttributes } from ".";

const ATTRIBUTE_NAME = "Attribute name";
const ATTRIBUTE_VALUE = "Attribute value";
const REMOVE_EU = "Remove eu from region";

describe("UserAccessAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isRestricted = false;
    h.isPending = false;
    h.authUser = { sub: "caller", org_id: "org-1" };
    h.users = {
      target: {
        itemId: "target",
        attributes: { other: { keep: 1 }, access: { "org-1": { region: ["eu"] }, "org-2": { x: ["1"] } } },
      },
      caller: { itemId: "caller", attributes: { access: { "org-1": { region: ["eu", "us"], team: ["a"] } } } },
    };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("lists the current organization's attributes as chips", () => {
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    expect(screen.getByRole("heading", { name: "Access attributes" })).toBeTruthy();
    expect(screen.getByText("region")).toBeTruthy();
    expect(screen.getByText("eu")).toBeTruthy();
    expect(screen.queryByText("x")).toBeNull();
  });

  it("says so when there are none", () => {
    h.users.target = { itemId: "target" };
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    expect(screen.getByText("No access attributes.")).toBeTruthy();
  });

  it("lets the system user type any name and value, and saves without touching other keys", async () => {
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);

    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await user.type(screen.getByLabelText(ATTRIBUTE_NAME), "team");
    await user.type(screen.getByLabelText(ATTRIBUTE_VALUE), "blue");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("blue")).toBeTruthy();

    await user.click(save);
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "target",
      attributes: {
        other: { keep: 1 },
        access: { "org-1": { region: ["eu"], team: ["blue"] }, "org-2": { x: ["1"] } },
      },
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("removes a value and can cancel the change", async () => {
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    await user.click(screen.getByRole("button", { name: REMOVE_EU }));
    expect(screen.queryByText("eu")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("eu")).toBeTruthy();
  });

  it("refuses an attribute name that is not an identifier", async () => {
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    await user.type(screen.getByLabelText(ATTRIBUTE_NAME), "a.b");
    await user.type(screen.getByLabelText(ATTRIBUTE_VALUE), "v");
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds the value on Enter, and ignores Enter while the name or value is missing", async () => {
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);

    await user.type(screen.getByLabelText(ATTRIBUTE_VALUE), "blue{Enter}");
    expect(screen.queryByText("blue")).toBeNull();

    await user.type(screen.getByLabelText(ATTRIBUTE_NAME), "team");
    await user.clear(screen.getByLabelText(ATTRIBUTE_VALUE));
    await user.type(screen.getByLabelText(ATTRIBUTE_VALUE), "{Enter}");
    expect(screen.queryByRole("button", { name: "Remove blue from team" })).toBeNull();

    await user.type(screen.getByLabelText(ATTRIBUTE_VALUE), "blue{Enter}");
    expect(screen.getByRole("button", { name: "Remove blue from team" })).toBeTruthy();
  });

  it("shows Saving... and locks Save and Cancel while the save runs", async () => {
    h.isPending = true;
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    await user.click(screen.getByRole("button", { name: REMOVE_EU }));

    expect((screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("limits a non-system caller to the names they hold", async () => {
    h.isRestricted = true;
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);

    expect(screen.queryByPlaceholderText("Attribute")).toBeNull();
    await user.click(screen.getByLabelText(ATTRIBUTE_NAME));
    expect(await screen.findByRole("option", { name: "region" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "team" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "secret" })).toBeNull();
  });

  it("offers a non-system caller only their own values for that name", async () => {
    h.isRestricted = true;
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);

    await user.click(screen.getByLabelText(ATTRIBUTE_NAME));
    await user.click(await screen.findByRole("option", { name: "region" }));
    await user.click(screen.getByLabelText(ATTRIBUTE_VALUE));
    expect(await screen.findByRole("option", { name: "us" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "asia" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "us" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Remove us from region" })).toBeTruthy();
  });

  it("shows the server's refusal as a toast", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { Access_Grant_Not_Allowed: "x" } });
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    await user.click(screen.getByRole("button", { name: REMOVE_EU }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { Access_Grant_Not_Allowed: "x" } }),
    );
  });

  it("shows an unsuccessful response and a failure without details", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "no" } });
    const user = userEvent.setup();
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    await user.click(screen.getByRole("button", { name: REMOVE_EU }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "no" } }));

    h.mutateAsync.mockRejectedValueOnce(new Error("boom"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenLastCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("falls back to the default organization when the token names none", () => {
    h.authUser = null;
    h.users.target = { itemId: "target", attributes: { access: { default: { region: ["eu"] } } } };
    render(<UserAccessAttributes userId="target" projectKey="pk" />);
    expect(screen.getByText("eu")).toBeTruthy();
  });
});
