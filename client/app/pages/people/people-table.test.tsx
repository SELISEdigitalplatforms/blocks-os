import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeopleGroupedByEnvironments } from "@/models/people";

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
  resendActivation: vi.fn(),
  transferOwnership: vi.fn(),
  isTransferring: false,
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

vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountResendActivation: () => ({ mutateAsync: h.resendActivation }),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const store = () => ({ selectedTenantGroup: "grp-1" });
  (store as unknown as { getState: () => unknown }).getState = () => ({
    selectedTenantGroup: "grp-1",
  });
  return { useProjectStore: store };
});

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: () => "blocks-key",
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

import { PeopleTable } from "./people-table";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";

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
    email: "ada@example.com",
    profileImageUrl: null,
    userId: "u-1",
    allowResendActivation: false,
    ...peopleOverrides,
  },
  sharedEnviroments,
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
    h.resendInvitation.mockResolvedValue(undefined);
    h.resendActivation.mockResolvedValue(undefined);
    h.transferOwnership.mockResolvedValue(undefined);
  });

  it("renders a row per person with name, email and mapped environment label", () => {
    renderTable({ people: [makePerson()], isLoading: false });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
  });

  it("falls back to the email prefix when the person has no name", () => {
    renderTable({
      people: [makePerson({ firstName: "", lastName: "", email: "solo@example.com" })],
      isLoading: false,
    });
    expect(screen.getByText("solo")).toBeTruthy();
  });

  it("shows a dash when name and email are missing", () => {
    renderTable({
      people: [makePerson({ firstName: "", lastName: "", email: "" })],
      isLoading: false,
    });
    expect(screen.getByText("---")).toBeTruthy();
  });

  it("renders the profile image when a url is present", () => {
    renderTable({
      people: [makePerson({ profileImageUrl: "https://img.example/a.png" })],
      isLoading: false,
    });
    const img = screen.getByAltText("Ada Lovelace") as HTMLImageElement;
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
    const emailCell = screen.getByText("ada@example.com");
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
    const row = screen.getByText("Ada Lovelace").closest("tr") as HTMLElement;
    await user.click(within(row).getByText("Ada Lovelace"));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/app/project/grp-1/people/u-1"));
  });

  it("shows the row action menu only for owners", () => {
    const { rerender } = renderTable({
      people: [makePerson()],
      isLoading: false,
      isViewerOwner: false,
    });
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();

    rerender(
      <MemoryRouter>
        <PeopleTable people={[makePerson()]} isLoading={false} isViewerOwner />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });

  it("hides the action cell content for a creator row", () => {
    renderTable({
      people: [makePerson({}, [makeEnv({ isCreator: true })])],
      isLoading: false,
      isViewerOwner: true,
    });
    // isRowUserOwner short-circuits the cell to null, so no menu button.
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  });

  describe("resend invitation flow", () => {
    const pending = () => makePerson({}, [makeEnv({ isInvitationConfirmed: false })]);

    it("resends an invitation and shows a success toast", async () => {
      const user = userEvent.setup();
      renderTable({ people: [pending()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Resend Invitation"));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() =>
        expect(h.resendInvitation).toHaveBeenCalledWith({
          email: "ada@example.com",
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
      renderTable({ people: [pending()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Resend Invitation"));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("cancels the resend invitation dialog", async () => {
      const user = userEvent.setup();
      renderTable({ people: [pending()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Resend Invitation"));
      const cancel = await screen.findByRole("button", { name: "Cancel" });
      await user.click(cancel);
      await waitFor(() => expect(h.resendInvitation).not.toHaveBeenCalled());
    });
  });

  describe("resend activation flow", () => {
    const activatable = () => makePerson({ allowResendActivation: true }, [makeEnv()]);

    it("resends activation mail and shows a success toast", async () => {
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Resend Activation"));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() =>
        expect(h.resendActivation).toHaveBeenCalledWith({
          userId: "u-1",
          projectKey: "blocks-key",
        }),
      );
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Resend activation mail successfully",
      });
    });

    it("shows an error toast when resend activation fails", async () => {
      h.resendActivation.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Resend Activation"));
      await user.click(await screen.findByRole("button", { name: "Resend" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("cancels the resend activation dialog", async () => {
      const user = userEvent.setup();
      renderTable({ people: [activatable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Resend Activation"));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(h.resendActivation).not.toHaveBeenCalled());
    });
  });

  describe("transfer ownership flow", () => {
    // Confirmed invite, no pending and not activatable -> only Transfer Ownership shows.
    const transferable = () => makePerson({}, [makeEnv({ isInvitationConfirmed: true })]);

    it("transfers ownership and shows a success toast", async () => {
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Transfer Ownership"));
      await user.click(await screen.findByRole("button", { name: "Transfer" }));
      await waitFor(() =>
        expect(h.transferOwnership).toHaveBeenCalledWith({
          tenantGroupId: "grp-1",
          transferToUserEmail: "ada@example.com",
        }),
      );
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "Ownership transferred successfully",
      });
    });

    it("shows an error toast when transfer ownership fails", async () => {
      h.transferOwnership.mockRejectedValueOnce(new Error("boom"));
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Transfer Ownership"));
      await user.click(await screen.findByRole("button", { name: "Transfer" }));
      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    });

    it("cancels the transfer ownership dialog", async () => {
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Transfer Ownership"));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(h.transferOwnership).not.toHaveBeenCalled());
    });

    it("disables the buttons and shows a pending label while transferring", async () => {
      h.isTransferring = true;
      const user = userEvent.setup();
      renderTable({ people: [transferable()], isLoading: false, isViewerOwner: true });
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await user.click(await screen.findByText("Transfer Ownership"));
      const transferring = await screen.findByRole("button", { name: "Transferring..." });
      expect(transferring).toBeTruthy();
      expect((transferring as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
