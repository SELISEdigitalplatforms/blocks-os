import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
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

const { mutateAsync, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({
    selectedProject: { itemId: "p1", tenantId: "t1" },
  }),
}));

vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useSaveOrganization: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast,
  showSuccessToast,
  showInfoToast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import { AddOrganization } from "./add-organization";

const openDialog = async () => {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: /Add Organization/ }),
  );
  return user;
};

describe("AddOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button and keeps the dialog closed initially", () => {
    render(<AddOrganization />);
    expect(
      screen.getByRole("button", { name: /Add Organization/ }),
    ).toBeTruthy();
    expect(screen.queryByText("Enter organization name")).toBeNull();
  });

  it("opens the dialog with the form and a disabled Add button", async () => {
    render(<AddOrganization />);
    await openDialog();
    expect(
      screen.getByText("Please fill in the details to add a new organization."),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Enter organization name"),
    ).toBeTruthy();
    const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  it("submits a valid name and shows a success toast", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    render(<AddOrganization />);
    const user = await openDialog();

    await user.type(
      screen.getByPlaceholderText("Enter organization name"),
      "New Org",
    );
    const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);

    await user.click(add);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        projectKey: "t1",
        name: "New Org",
        itemId: "",
        isEnable: true,
      }),
    );
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it("blocks submission and shows a validation error for a blank name", async () => {
    render(<AddOrganization />);
    const user = await openDialog();

    // Whitespace makes the form dirty (enabling Add) but fails zod's trim/min(1).
    await user.type(
      screen.getByPlaceholderText("Enter organization name"),
      "   ",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
