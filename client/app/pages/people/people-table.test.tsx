import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => h.navigate,
    useParams: () => ({ tenantGroupId: "grp-1" }),
  };
});

vi.mock("@/hooks/use-people", () => ({
  useRemoveAccess: () => ({ mutateAsync: vi.fn() }),
  useResendInvitation: () => ({ mutateAsync: vi.fn() }),
  useTransferOwnership: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountResendActivation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@seliseblocks/blocks-kit", () => {
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

const makePerson = (
  overrides: Partial<PeopleGroupedByEnvironments["peopleDetails"]> = {},
): PeopleGroupedByEnvironments => ({
  peopleDetails: {
    salutation: "",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    profileImageUrl: null,
    userId: "u-1",
    allowResendActivation: false,
    ...overrides,
  },
  sharedEnviroments: [
    {
      itemId: "e-1",
      tenantId: "t-1",
      isInvitationSent: true,
      isInvitationConfirmed: true,
      isCreator: false,
      enviroment: "dev",
    },
  ],
});

const renderTable = (props: Parameters<typeof PeopleTable>[0]) =>
  render(
    <MemoryRouter>
      <PeopleTable {...props} />
    </MemoryRouter>,
  );

describe("PeopleTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row per person with name, email and mapped environment label", () => {
    renderTable({ people: [makePerson()], isLoading: false });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    // "dev" is mapped to its display label via environmentOptions.
    expect(screen.getByText("Development")).toBeTruthy();
  });

  it("shows the empty state when there are no people", () => {
    renderTable({ people: [], isLoading: false });
    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("renders skeleton rows while loading and no empty-state message", () => {
    renderTable({ people: [], isLoading: true });
    expect(screen.queryByText("No results found.")).toBeNull();
    // Header row + 5 skeleton rows.
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("navigates to the person detail route when a data row is clicked", async () => {
    const user = userEvent.setup();
    renderTable({ people: [makePerson()], isLoading: false });
    const row = screen.getByText("Ada Lovelace").closest("tr") as HTMLElement;
    await user.click(within(row).getByText("Ada Lovelace"));
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith(
        "/app/project/grp-1/people/u-1",
      ),
    );
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
});
