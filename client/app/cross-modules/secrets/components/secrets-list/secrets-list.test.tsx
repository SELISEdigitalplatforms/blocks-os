import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetSecrets: vi.fn(),
  deleteSecret: vi.fn(),
  isDeleting: false,
  saveSecret: vi.fn(),
}));

vi.mock("../../hooks/use-secrets", () => ({
  useGetSecrets: (key: string) => h.useGetSecrets(key),
  useDeleteSecret: () => ({ mutate: h.deleteSecret, isPending: h.isDeleting }),
  useSaveSecret: () => ({ mutate: h.saveSecret, isPending: false }),
}));

import { SecretsList } from "./secrets-list";

const secrets = [
  {
    itemId: "s-1",
    createdDate: "2025-01-02T00:00:00Z",
    keyValuePairs: { secretName: "db-creds", username: "admin", password: "hunter2" },
  },
  {
    itemId: "s-2",
    createdDate: "2025-02-05T00:00:00Z",
    keyValuePairs: { secretName: "empty-secret" },
  },
];

describe("SecretsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isDeleting = false;
    h.useGetSecrets.mockReturnValue({ data: secrets, isLoading: false });
  });

  it("renders a loading skeleton while fetching", () => {
    h.useGetSecrets.mockReturnValue({ data: [], isLoading: true });
    const { container } = render(<SecretsList />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("renders the empty state when there are no secrets", () => {
    h.useGetSecrets.mockReturnValue({ data: [], isLoading: false });
    render(<SecretsList />);
    expect(screen.getByText("No secrets yet")).toBeTruthy();
  });

  it("renders a row per secret with its name and key count", () => {
    render(<SecretsList />);
    expect(screen.getByText("db-creds")).toBeTruthy();
    expect(screen.getByText("empty-secret")).toBeTruthy();
    expect(screen.getByText("2 keys")).toBeTruthy();
  });

  it("toggles a secret row to hide and reveal its key-value pairs", async () => {
    const user = userEvent.setup();
    render(<SecretsList />);
    // The first row is expanded by default, so its keys are visible.
    expect(screen.getByText("username")).toBeTruthy();
    expect(screen.getByText("password")).toBeTruthy();
    // Collapsing hides them.
    await user.click(screen.getByText("db-creds"));
    await waitFor(() => expect(screen.queryByText("username")).toBeNull());
    // Expanding again brings them back.
    await user.click(screen.getByText("db-creds"));
    expect(await screen.findByText("username")).toBeTruthy();
  });

  it("deletes a secret after confirming in the dialog", async () => {
    const user = userEvent.setup();
    h.deleteSecret.mockImplementation((_id, opts) => opts?.onSuccess?.());
    render(<SecretsList />);
    const row = screen.getByText("db-creds").closest("tr") as HTMLElement;
    const trash = within(row)
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"));
    await user.click(trash as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Delete Secret" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.deleteSecret).toHaveBeenCalledWith("s-1", expect.anything()));
  });

  it("opens the edit modal from the pencil action", async () => {
    const user = userEvent.setup();
    render(<SecretsList />);
    const row = screen.getByText("db-creds").closest("tr") as HTMLElement;
    const pencil = within(row)
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-pencil"));
    await user.click(pencil as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Edit Secret" })).toBeTruthy();
  });
});
