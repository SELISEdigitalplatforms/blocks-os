import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsync, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-clients", () => ({
  useDeleteAuthClient: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast, showSuccessToast }));

import { ClientCredentialsCard } from "./client-credential-card";

const makeClient = (overrides = {}) => ({
  itemId: "client-abcdef123456",
  name: "My Client",
  clientSecret: "secret-abcdef123456",
  isActive: true,
  roles: ["admin", "user"],
  permissions: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
  accessTokenValidForNumberMinutes: 90,
  createdDate: "2024-01-02T10:30:00Z",
  lastUpdatedDate: "2024-02-03T12:00:00Z",
  ...overrides,
});

describe("ClientCredentialsCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the client name, active status, roles and lifetime", () => {
    render(<ClientCredentialsCard clientCredential={makeClient() as never} />);
    expect(screen.getByText("My Client")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    // 90 minutes -> "1 h 30 m"
    expect(screen.getByText("1 h 30 m")).toBeTruthy();
  });

  it("shows an inactive badge and a dash lifetime for zero minutes", () => {
    render(
      <ClientCredentialsCard
        clientCredential={makeClient({ isActive: false, accessTokenValidForNumberMinutes: 0 }) as never}
      />,
    );
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("limits visible permission chips and shows the overflow count", () => {
    render(<ClientCredentialsCard clientCredential={makeClient() as never} />);
    // 7 permissions, 5 visible + "+2 more"
    expect(screen.getByText("+2 more")).toBeTruthy();
  });

  it("shows N/A when there are no roles or permissions", () => {
    render(
      <ClientCredentialsCard
        clientCredential={makeClient({ roles: [], permissions: [] }) as never}
      />,
    );
    expect(screen.getAllByText("N/A").length).toBe(2);
  });

  it("calls onEdit when the edit button is clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    const client = makeClient();
    render(<ClientCredentialsCard clientCredential={client as never} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: /Edit client credential/ }));
    expect(onEdit).toHaveBeenCalledWith(client);
  });

  it("deletes the client after confirmation and shows a success toast", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<ClientCredentialsCard clientCredential={makeClient() as never} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    // confirmation modal appears; confirm it
    const confirm = await screen.findByRole("button", { name: "Yes" });
    await user.click(confirm);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ itemId: "client-abcdef123456" }));
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when deletion fails", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "cannot" } });
    const user = userEvent.setup();
    render(<ClientCredentialsCard clientCredential={makeClient() as never} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("button", { name: "Yes" });
    await user.click(confirm);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    expect(showSuccessToast).not.toHaveBeenCalled();
  });
});
