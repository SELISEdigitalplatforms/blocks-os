import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsync, showErrorToast, showSuccessToast, useGetProjects } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  useGetProjects: vi.fn(),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedTenantGroup: "group-1" }),
}));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  usePopoverWidth: () => [{ current: null }, 200],
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-people", () => ({
  useInvitePeople: () => ({ isPending: false, mutateAsync }),
}));

vi.mock("@/hooks/use-project", () => ({ useGetProjects }));

vi.mock("@/hooks/use-toast", () => ({ showErrorToast, showSuccessToast }));

import { InvitePeople } from "./invite-people";

const projects = [
  {
    projects: [
      { tenantId: "t-dev", environment: "dev" },
      { tenantId: "t-prod", environment: "production" },
    ],
  },
];

describe("InvitePeople", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetProjects.mockReturnValue({ data: projects });
  });

  it("renders nothing when the viewer is not an owner", () => {
    const { container } = render(<InvitePeople isViewerOwner={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the invite trigger for an owner", () => {
    render(<InvitePeople isViewerOwner />);
    expect(screen.getByRole("button", { name: /Invite/ })).toBeTruthy();
  });

  it("opens the dialog with one invitation row and a disabled Send button", async () => {
    const user = userEvent.setup();
    render(<InvitePeople isViewerOwner />);
    await user.click(screen.getByRole("button", { name: /Invite/ }));
    expect(await screen.findByText("Invite people")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter email")).toBeTruthy();
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });

  it("adds and removes invitation rows", async () => {
    const user = userEvent.setup();
    render(<InvitePeople isViewerOwner />);
    await user.click(screen.getByRole("button", { name: /Invite/ }));
    await user.click(screen.getByRole("button", { name: /Add another/ }));
    expect(screen.getAllByPlaceholderText("Enter email")).toHaveLength(2);
    // remove buttons appear once there is more than one row
    const removeButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-trash2"));
    await user.click(removeButtons[0]);
    await waitFor(() => expect(screen.getAllByPlaceholderText("Enter email")).toHaveLength(1));
  });

  it("submits a valid invitation and shows a success toast", async () => {
    mutateAsync.mockResolvedValueOnce({ results: { "new@x.com": "invited" } });
    const user = userEvent.setup();
    render(<InvitePeople isViewerOwner />);
    await user.click(screen.getByRole("button", { name: /Invite/ }));

    await user.type(screen.getByPlaceholderText("Enter email"), "new@x.com");

    // pick an environment from the MultiSelect
    await user.click(screen.getByRole("button", { name: /Select environments/ }));
    const devOption = await screen.findByText("Development");
    await user.click(devOption);

    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    await waitFor(() => expect(send.disabled).toBe(false));
    await user.click(send);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.groupId).toBe("group-1");
    expect(payload.invitations["new@x.com"]).toBeTruthy();
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when every recipient is skipped", async () => {
    mutateAsync.mockResolvedValueOnce({ results: { "new@x.com": "already_has_access" } });
    const user = userEvent.setup();
    render(<InvitePeople isViewerOwner />);
    await user.click(screen.getByRole("button", { name: /Invite/ }));
    await user.type(screen.getByPlaceholderText("Enter email"), "new@x.com");
    await user.click(screen.getByRole("button", { name: /Select environments/ }));
    await user.click(await screen.findByText("Development"));
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it("surfaces a limit error message from a failed mutation", async () => {
    mutateAsync.mockRejectedValueOnce({ errors: { exceed_limit: "Seat limit reached" } });
    const user = userEvent.setup();
    render(<InvitePeople isViewerOwner />);
    await user.click(screen.getByRole("button", { name: /Invite/ }));
    await user.type(screen.getByPlaceholderText("Enter email"), "new@x.com");
    await user.click(screen.getByRole("button", { name: /Select environments/ }));
    await user.click(await screen.findByText("Development"));
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Seat limit reached" }),
    );
  });

  it("blocks an invalid email format", async () => {
    const user = userEvent.setup();
    render(<InvitePeople isViewerOwner />);
    await user.click(screen.getByRole("button", { name: /Invite/ }));
    const input = screen.getByPlaceholderText("Enter email");
    await user.type(input, "bad-email");
    await user.tab();
    expect(await screen.findByText("Invalid email format")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
