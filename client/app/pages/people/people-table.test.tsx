import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeopleGroupedByEnvironments } from "../../models/people";

const ADA_EMAIL = "ada@example.com";
const ADA_NAME = "Ada Lovelace";
const RESEND_INVITATION = "Resend Invitation";
const RESEND_ACTIVATION = "Resend Activation";
const TRANSFER_OWNERSHIP = "Transfer Ownership";

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

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  removeAsync: vi.fn(),
  resendInvitation: vi.fn(),
  transferOwnership: vi.fn(),
  isTransferring: false,
  viewerSub: "viewer-1",
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => h.navigate,
    useParams: () => ({ tenantGroupId: "grp-1" }),
  };
});

vi.mock("@/hooks/use-people", () => ({
  useRemoveAccess: () => ({ mutateAsync: h.removeAsync }),
  useResendInvitation: () => ({ mutateAsync: h.resendInvitation }),
  useTransferOwnership: () => ({ mutateAsync: h.transferOwnership, isPending: h.isTransferring }),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const store = () => ({ selectedTenantGroup: "grp-1" });
  (store as unknown as { getState: () => unknown }).getState = () => ({
    selectedTenantGroup: "grp-1",
  });
  return { useProjectStore: store };
});

vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: (select: (state: { user: { sub: string } }) => unknown) =>
    select({ user: { sub: h.viewerSub } }),
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: () => "blocks-key",
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

import { PeopleTable } from "./people-table";
import { showErrorToast, showSuccessToast } from "../../hooks/use-toast";

const REMOVE_LABEL = "Remove access";

type Env = PeopleGroupedByEnvironments["sharedEnviroments"][number];

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  itemId: "e-1",
  tenantId: "t-1",
  isInvitationSent: true,
  isInvitationConfirmed: true,
  isCreator: false,
  enviroment: "dev",
  ...overrides,
});

const makePerson = (
  peopleOverrides: Partial<PeopleGroupedByEnvironments["peopleDetails"]> = {},
  sharedEnviroments: Env[] = [makeEnv()],
): PeopleGroupedByEnvironments => ({
  peopleDetails: {
    salutation: "",
    firstName: "Ada",
    lastName: "Lovelace",
    email: ADA_EMAIL,
    profileImageUrl: null,
    userId: "u-1",
    allowResendActivation: false,
    ...peopleOverrides,
  },
  sharedEnviroments,
  accessPolicies: [],
  role: "contributor",
});

const renderTable = (props: Parameters<typeof PeopleTable>[0]) =>
  render(
    <MemoryRouter>
      <PeopleTable {...props} />
    </MemoryRouter>,
  );

describe("PeopleTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isTransferring = false;
    h.resendInvitation.mockResolvedValue({ isSuccess: true });
    h.removeAsync.mockResolvedValue({ isSuccess: true });
    h.viewerSub = "viewer-1";
    h.transferOwnership.mockResolvedValue(undefined);
  });

  it("renders a row per person with name, email and mapped environment label", () => {
    renderTable({ people: [makePerson()], isLoading: false });
    expect(screen.getByText(ADA_NAME)).toBeTruthy();
    expect(screen.getByText(ADA_EMAIL)).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
  });

  it("falls back to the email prefix when the person has no name", () => {
    renderTable({
      people: [makePerson({ firstName: "", lastName: "", email: "solo@example.com" })],
      isLoading: false,
    });
    expect(screen.getByText("solo")).toBeTruthy();
  });

  it("falls back to the email prefix when firstName is null (not the string null)", () => {
    renderTable({
      people: [makePerson({ firstName: null, lastName: null, email: "owner@example.com" })],
      isLoading: false,
    });
    expect(screen.getByText("owner")).toBeTruthy();
    expect(screen.queryByText(/^null$/)).toBeNull();
  });

  it("shows a dash when name and email are missing", () => {
    renderTable({
      people: [makePerson({ firstName: "", lastName: "", email: "" })],
      isLoading: false,
    });
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the profile image when a url is present", () => {
    renderTable({
      people: [makePerson({ profileImageUrl: "https://img.example/a.png" })],
      isLoading: false,
    });
    const img = screen.getByAltText(ADA_NAME) as HTMLImageElement;
    expect(img.src).toContain("https://img.example/a.png");
  });

  it("renders the Owner badge for a creator environment", () => {
    renderTable({
      people: [makePerson({}, [makeEnv({ isCreator: true })])],
      isLoading: false,
    });
    expect(screen.getByText("Owner")).toBeTruthy();
  });

  it("renders the Pending Invite badge for unconfirmed non-creator invites", () => {
    renderTable({
      people: [makePerson({}, [makeEnv({ isInvitationConfirmed: false })])],
      isLoading: false,
    });
    expect(screen.getByText("Pending Invite")).toBeTruthy();
  });

  it("renders the Inactive badge when activation is allowed", () => {
    renderTable({
      people: [makePerson({ allowResendActivation: true })],
      isLoading: false,
    });
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("collapses more than three environments into a +N badge", () => {
    renderTable({
      people: [
        makePerson({}, [
          makeEnv({ itemId: "a", enviroment: "dev" }),
          makeEnv({ itemId: "b", enviroment: "stage" }),
          makeEnv({ itemId: "c", enviroment: "prod" }),
          makeEnv({ itemId: "d", enviroment: "custom" }),
        ]),
      ],
      isLoading: false,
    });
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("shows a dash for the environments column when there are none", () => {
    renderTable({ people: [makePerson({}, [])], isLoading: false });
    const emailCell = screen.getByText(ADA_EMAIL);
    expect(emailCell).toBeTruthy();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no people", () => {
    renderTable({ people: [], isLoading: false });
    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("renders skeleton rows while loading and no empty-state message", () => {
    renderTable({ people: [], isLoading: true });
    expect(screen.queryByText("No results found.")).toBeNull();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("navigates to the person detail route when a data row is clicked", async () => {
    const user = userEvent.setup();
    renderTable({ people: [makePerson()], isLoading: false });
    const row = screen.getByText(ADA_NAME).closest("tr") as HTMLElement;
    await user.click(within(row).getByText(ADA_NAME));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/app/project/grp-1/people/u-1"));
  });

  it("shows the row action menu only for owners", () => {
    const { rerender } = renderTable({
      people: [makePerson()],
      isLoading: false,
      canInvite: false, canRemove: false, isOwner: false,
    });
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();

    rerender(
      <MemoryRouter>
        <PeopleTable people={[makePerson()]} isLoading={false} canInvite canRemove isOwner />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });

  it("hides the action cell content for a creator row", () => {
    renderTable({
      people: [makePerson({}, [makeEnv({ isCreator: true })])],
      isLoading: false,
      canInvite: true, canRemove: true, isOwner: true,
    });
    // isRowUserOwner short-circuits the cell to null, so no menu button.
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  });

  describe("deactivated user", () => {
    it("shows the Inactive badge and offers no row actions", () => {
      renderTable({
        people: [makePerson({ isActive: false })],
        isLoading: false,
        canInvite: true,
        canRemove: true,
        isOwner: true,
      });
      expect(screen.getByText("Inactive")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    });
  });

  describe("remove access flow", () => {
    const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Open menu" }));

    it("offers Remove access to someone holding the remove grant and revokes after confirming", async () => {
      const user = userEvent.setup();
      renderTable({ people: [makePerson()], isLoading: false, canRemove: true });
      await openMenu(user);
      await user.click(await screen.findByText(REMOVE_LABEL));
      await user.click(await screen.findByRole("button", { name: "Revoke" }));
      await waitFor(() =>
        expect(h.removeAsync).toHaveBeenCalledWith({
          email: ADA_EMAIL,
          tenantIds: ["t-1"],
          groupId: "grp-1",
        }),
      );
      expect(showSuccessToast).toHaveBeenCalledWith({ description: "Removed access successfully" });
    });

    it("shows an error toast when the server refuses the removal", async () => {
      h.removeAsync.mockResolvedValueOnce({ isSuccess: false, errors: { access: "denied" } });
      const user = userEvent.setup();
      renderTable({ people: [makePerson()], isLoading: false, canRemove: true });
      await openMenu(user);
      await user.click(await screen.findByText(REMOVE_LABEL));
      await user.click(await screen.findByRole("button", { name: "Revoke" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith({ errors: { access: "denied" } }));
      expect(showSuccessToast).not.toHaveBeenCalled();
    });

    it("does not offer Remove access without the grant", async () => {
      const user = userEvent.setup();
      renderTable({ people: [makePerson()], isLoading: false, canInvite: true, isOwner: true });
      await openMenu(user);
      expect(screen.queryByText(REMOVE_LABEL)).toBeNull();
    });

    it("does not offer Remove access on the viewer's own row", () => {
      h.viewerSub = "u-1";
      renderTable({ people: [makePerson()], isLoading: false, canRemove: true });
      // No other action applies, so the row has no menu at all.
      expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    });
  });

  describe("resend invitation flow", () => {
    const pending = () => makePerson({}, [makeEnv({ isInvitationConfirmed: false })]);

    it("resends an invitation and shows a success toast", async () => {
      const user = userEvent.setup();
      renderTable({ people: [pending()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_INVITATION));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() =>
        expect(h.resendInvitation).toHaveBeenCalledWith({
          email: ADA_EMAIL,
          groupId: "grp-1",
        }),
      );
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Resend invitation mail successfully",
      });
    });

    it("shows an error toast when resend invitation fails", async () => {
      h.resendInvitation.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      renderTable({ people: [pending()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_INVITATION));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("cancels the resend invitation dialog", async () => {
      const user = userEvent.setup();
      renderTable({ people: [pending()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_INVITATION));
      const cancel = await screen.findByRole("button", { name: "Cancel" });
      await user.click(cancel);
      await waitFor(() => expect(h.resendInvitation).not.toHaveBeenCalled());
    });
  });

  describe("resend activation flow", () => {
    const activatable = () => makePerson({ allowResendActivation: true }, [makeEnv()]);

    it("resends activation mail and shows a success toast", async () => {
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_ACTIVATION));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() =>
        expect(h.resendInvitation).toHaveBeenCalledWith({
          email: ADA_EMAIL,
          groupId: "grp-1",
        }),
      );
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Resend activation mail successfully",
      });
    });

    it("shows an error toast when resend activation fails", async () => {
      h.resendInvitation.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_ACTIVATION));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("shows an error toast, not a success one, when the server answers isSuccess false", async () => {
      h.resendInvitation.mockResolvedValueOnce({ isSuccess: false, errors: { user: "inactive" } });
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_ACTIVATION));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith({ errors: { user: "inactive" } }));
      expect(showSuccessToast).not.toHaveBeenCalled();
    });

    it("cancels the resend activation dialog", async () => {
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(RESEND_ACTIVATION));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(h.resendInvitation).not.toHaveBeenCalled());
    });
  });

  describe("transfer ownership flow", () => {
    // Confirmed invite, no pending and not activatable -> only Transfer Ownership shows.
    const transferable = () => makePerson({}, [makeEnv({ isInvitationConfirmed: true })]);

    it("transfers ownership and shows a success toast", async () => {
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(TRANSFER_OWNERSHIP));
      await user.click(await screen.findByRole("button", { name: "Transfer" }));
      await waitFor(() =>
        expect(h.transferOwnership).toHaveBeenCalledWith({
          tenantGroupId: "grp-1",
          transferToUserEmail: ADA_EMAIL,
        }),
      );
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Ownership transferred successfully",
      });
    });

    it("shows an error toast when transfer ownership fails", async () => {
      h.transferOwnership.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(TRANSFER_OWNERSHIP));
      await user.click(await screen.findByRole("button", { name: "Transfer" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("cancels the transfer ownership dialog", async () => {
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(TRANSFER_OWNERSHIP));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(h.transferOwnership).not.toHaveBeenCalled());
    });

    it("disables the buttons and shows a pending label while transferring", async () => {
      h.isTransferring = true;
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, canInvite: true, canRemove: true, isOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText(TRANSFER_OWNERSHIP));
      const transferring = await screen.findByRole("button", { name: "Transferring..." });
      expect(transferring).toBeTruthy();
      expect((transferring as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
