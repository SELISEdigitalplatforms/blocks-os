import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lastRolesQuery: null as Record<string, unknown> | null,
  roleCallCount: 0,
  roles: [] as Array<Record<string, unknown>>,
  totalCount: 0,
  isLoading: false,
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (option: Record<string, unknown>) => {
    h.lastRolesQuery = option;
    h.roleCallCount += 1;
    return { data: { data: h.roles, totalCount: h.totalCount }, isLoading: h.isLoading };
  },
}));
vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SearchInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
      <input
        data-testid="role-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  },
}));

import { BulkRolesDialog } from "./bulk-roles-dialog";

const role = (slug: string, name = slug) => ({
  itemId: `r-${slug}`,
  slug,
  name,
  description: "",
});

const renderDialog = (props: Partial<Parameters<typeof BulkRolesDialog>[0]> = {}) =>
  render(
    <BulkRolesDialog
      open
      mode="add"
      projectKey="t1"
      organizationId="org-1"
      organizationLabel="Org One"
      selectedCount={8}
      heldRoleCounts={null}
      isBusy={false}
      onOpenChange={vi.fn()}
      onContinue={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.lastRolesQuery = null;
  h.roleCallCount = 0;
  h.roles = [role("member", "Member"), role("editor", "Editor"), role("viewer", "Viewer")];
  h.totalCount = 3;
  h.isLoading = false;
});

describe("BulkRolesDialog — add", () => {
  it("keeps Continue disabled until at least one role is ticked", () => {
    renderDialog();

    const continueButton = screen.getByTestId("bulk-roles-continue") as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    fireEvent.click(screen.getByText("Viewer"));

    expect((screen.getByTestId("bulk-roles-continue") as HTMLButtonElement).disabled).toBe(false);
  });

  it("hands the ticked slugs to the page", () => {
    const onContinue = vi.fn();
    renderDialog({ onContinue });

    fireEvent.click(screen.getByText("Viewer"));
    fireEvent.click(screen.getByText("Editor"));
    fireEvent.click(screen.getByTestId("bulk-roles-continue"));

    expect(onContinue).toHaveBeenCalledWith(["viewer", "editor"]);
  });

  it("shows the organization as a locked field rather than a choice", () => {
    // The organization comes from the page filter, which is also what made the
    // selection possible; offering a choice here could write into an organization
    // the matched users are not in.
    renderDialog();

    const field = screen.getByTestId("bulk-roles-organization");
    expect(field.textContent).toContain("Org One");
    expect(field.querySelector("input")).toBeNull();
    expect(field.querySelector("select")).toBeNull();
  });

  it("lists every role and never mentions a cap", () => {
    // No per-user role limit exists server-side, so nothing in this component may
    // disable, hide or explain away a role on those grounds.
    renderDialog();

    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("Editor")).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/maximum|cap|limit/i);
    screen
      .getAllByRole("checkbox")
      .forEach((box) => expect(box.getAttribute("disabled")).toBeNull());
  });

  it("scopes the role list to the organization the change targets", () => {
    // Roles live under an organization key. Listing another organization's would
    // offer slugs that do not exist where they are about to be written.
    renderDialog({ organizationId: "org-1" });

    expect(h.lastRolesQuery?.organizationId).toBe("org-1");
  });

  it("searches and paginates the ordinary role list", () => {
    h.totalCount = 40;
    renderDialog();

    fireEvent.change(screen.getByTestId("role-search"), { target: { value: "vie" } });

    expect((h.lastRolesQuery?.filter as { search?: string }).search).toBe("vie");
    expect(h.lastRolesQuery?.page).toBe(0);
  });

  it("disables both footer actions while the preview is in flight", () => {
    renderDialog({ isBusy: true });

    expect((screen.getByTestId("bulk-roles-continue") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Cancel") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("BulkRolesDialog — remove", () => {
  it("asks only for the held slugs and shows a count per role", () => {
    h.roles = [role("member", "Member"), role("viewer", "Viewer")];
    renderDialog({ mode: "remove", heldRoleCounts: { member: 8, viewer: 3 } });

    expect((h.lastRolesQuery?.filter as { slugs?: string[] }).slugs).toEqual(["member", "viewer"]);
    expect(screen.getByText("Held by 8 of the 8 selected users")).toBeTruthy();
    expect(screen.getByText("Held by 3 of the 8 selected users")).toBeTruthy();
    expect(screen.queryByTestId("bulk-roles-counts-unavailable")).toBeNull();
  });

  it("hides the search box when the list is already the held set", () => {
    renderDialog({ mode: "remove", heldRoleCounts: { member: 8 } });

    expect(screen.queryByTestId("role-search")).toBeNull();
  });

  it("falls back to every role with no counts when the held set is unknowable", () => {
    // With every matching user selected the client holds one page of a much larger
    // set, so a count would describe the wrong population. Listing everything and
    // saying why beats a number nobody can stand behind.
    renderDialog({ mode: "remove", heldRoleCounts: null, selectedCount: 312 });

    expect((h.lastRolesQuery?.filter as { slugs?: string[] }).slugs).toBeUndefined();
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("Editor")).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Held by");
    expect(screen.getByTestId("bulk-roles-counts-unavailable").textContent).toContain(
      "Counts are unavailable",
    );
  });

  it("scopes the held-slug lookup to the same organization", () => {
    // Without this the slugs resolve against the default organization and come back
    // empty, so the dialog lists nothing to remove.
    renderDialog({ mode: "remove", organizationId: "org-1", heldRoleCounts: { member: 8 } });

    expect(h.lastRolesQuery?.organizationId).toBe("org-1");
    expect((h.lastRolesQuery?.filter as { slugs?: string[] }).slugs).toEqual(["member"]);
  });

  it("issues no extra request to work out the held roles", () => {
    // The held set comes from records the page already has; asking the server again
    // would be a round trip for something already in hand.
    renderDialog({ mode: "remove", heldRoleCounts: { member: 8, viewer: 3 } });

    expect(h.roleCallCount).toBe(1);
  });
});
