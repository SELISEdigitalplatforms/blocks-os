import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const h = vi.hoisted(() => ({
  isLoading: false,
  isFetching: false,
  data: { data: [], totalCount: 0 } as { data: unknown[]; totalCount: number },
  queryParams: {} as Record<string, string | number | string[]>,
  isMultiOrgEnabled: true,
  organizations: [{ itemId: "default", name: "Default" }] as unknown[],
  lastQuery: null as Record<string, unknown> | null,
  tableProps: null as Record<string, unknown> | null,
  previewMutate: vi.fn(),
  submitMutate: vi.fn(),
  isPreviewPending: false,
  isSubmitPending: false,
  successToast: vi.fn(),
  errorToast: vi.fn(),
  dialogProps: null as Record<string, unknown> | null,
  reviewProps: null as Record<string, unknown> | null,
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUsers: (q: Record<string, unknown>) => {
    h.lastQuery = q;
    return { isLoading: h.isLoading, isFetching: h.isFetching, data: h.data };
  },
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetEnabledOrganizationsInfinite: () => ({
    data: { pages: [{ organizations: h.organizations }] },
    hasNextPage: false,
  }),
  getEnabledOrganizationsFromPages: (pages: Array<{ organizations: unknown[] }>) =>
    pages.flatMap((page) => page.organizations),
  useGetOrganizationConfig: () => ({ data: { isMultiOrgEnabled: h.isMultiOrgEnabled } }),
}));
vi.mock("@/store/useProjectStore", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("./users-table", () => ({
  UsersTable: (props: Record<string, unknown>) => {
    h.tableProps = props;
    return <div data-testid="users-table">rows:{(props.users as unknown[]).length}</div>;
  },
}));
vi.mock("@blocks-idp/iam/hooks/use-bulk-user-roles", () => ({
  usePreviewBulkRoleChange: () => ({
    mutateAsync: h.previewMutate,
    isPending: h.isPreviewPending,
  }),
  useSubmitBulkRoleChange: () => ({
    mutateAsync: h.submitMutate,
    isPending: h.isSubmitPending,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (args: unknown) => h.successToast(args),
  showErrorToast: (args: unknown) => h.errorToast(args),
}));
// The dialogs are exercised in their own test files; stubbing them here keeps these
// tests about the gate and the selection lifecycle.
vi.mock("./bulk-roles-dialog", () => ({
  BulkRolesDialog: (props: Record<string, unknown>) => {
    h.dialogProps = props;
    return <div data-testid="bulk-roles-dialog">{String(props.mode)}</div>;
  },
}));
vi.mock("./bulk-role-review-dialog", () => ({
  BulkRoleReviewDialog: (props: Record<string, unknown>) => {
    h.reviewProps = props;
    return <div data-testid="bulk-review-dialog" />;
  },
}));
vi.mock("./users-filter-toolbar", () => ({
  UsersSearchFilter: () => <div data-testid="search-filter" />,
  UsersDateFilters: () => <div data-testid="date-filter" />,
  useUsersFilterQueryParams: () => ({ queryParams: h.queryParams, setQueryParams: vi.fn() }),
  useUsersSortQueryParams: () => ({ sortQueryParams: {} }),
}));

import { Users } from "./users";

beforeEach(() => {
  vi.clearAllMocks();
  h.isLoading = false;
  h.isFetching = false;
  h.data = { data: [], totalCount: 0 };
  h.queryParams = {
    page: 0,
    pageSize: 10,
    "selected-filter": "name",
    name: "alice",
    email: "a@b.co",
    organizationIds: [],
    roles: [],
  };
  h.isMultiOrgEnabled = true;
  h.organizations = [{ itemId: "default", name: "Default" }];
  h.isPreviewPending = false;
  h.isSubmitPending = false;
  h.dialogProps = null;
  h.reviewProps = null;
  h.previewMutate = vi.fn().mockResolvedValue({
    isSuccess: true,
    errors: null,
    matchedCount: 312,
    affectedCount: 309,
    unchangedCount: 3,
  });
  h.submitMutate = vi.fn().mockResolvedValue({
    isSuccess: true,
    errors: null,
    batchId: "b_1",
    matchedCount: 312,
  });
  h.successToast = vi.fn();
  h.errorToast = vi.fn();
});

describe("Users", () => {
  it("renders the search and date filters plus the users table", () => {
    h.data = { data: [{ id: 1 }, { id: 2 }], totalCount: 2 };
    render(<Users />);
    expect(screen.getByTestId("search-filter")).toBeTruthy();
    expect(screen.getByTestId("date-filter")).toBeTruthy();
    expect((screen.getByTestId("users-table") as HTMLElement).textContent).toContain("rows:2");
  });

  it("keeps search and advanced filters in one responsive toolbar", () => {
    render(<Users />);
    expect(screen.getByTestId("users-filter-row").className).toContain("flex-row");
    expect(screen.getByTestId("users-filter-row").className).not.toContain("border");
    expect(screen.getByTestId("users-filter-row").className).toContain("min-w-0");
    expect(screen.getByTestId("users-search-filter-slot").className).toContain("flex-1");
    expect(screen.getByTestId("users-search-filter-slot").className).toContain("sm:flex-none");
    expect(screen.getByTestId("users-search-filter-slot").className).toContain("overflow-hidden");
    expect(screen.getByTestId("users-advanced-filter-slot").className).toContain("shrink-0");
  });

  it("uses the name as query text when the name filter is selected", () => {
    render(<Users />);
    expect(h.lastQuery?.query).toBe("alice");
  });

  it("uses the email as query text when the email filter is selected", () => {
    h.queryParams["selected-filter"] = "email";
    render(<Users />);
    expect(h.lastQuery?.query).toBe("a@b.co");
  });

  it("sends the created-date selection using the API joinedOn field", () => {
    h.queryParams["joinedOn-start"] = "2026-09-01T00:00:00.000Z";
    render(<Users />);
    const filter = h.lastQuery?.filter as {
      createdDate?: string;
      joinedOn?: string;
    };
    expect(filter.joinedOn).toBe("2026-09-01T00:00:00.000Z");
    expect(filter.createdDate).toBeUndefined();
  });

  it("marks the table as loading while fetching", () => {
    h.isFetching = true;
    render(<Users />);
    expect(h.tableProps?.isLoading).toBe(true);
  });

  it("sends selected organization ids and roles", () => {
    h.queryParams.organizationIds = ["org-1", "org-2"];
    h.queryParams.roles = ["admin"];
    render(<Users />);
    expect((h.lastQuery?.filter as { organizationIds?: string[] }).organizationIds).toEqual([
      "org-1",
      "org-2",
    ]);
    expect((h.lastQuery?.filter as { roles?: string[] }).roles).toEqual(["admin"]);
  });

  it("omits stale roles when multi-org is enabled but no organization is selected", () => {
    h.queryParams.organizationIds = [];
    h.queryParams.roles = ["auditor"];
    render(<Users />);
    expect((h.lastQuery?.filter as { organizationIds?: string[] }).organizationIds).toBeUndefined();
    expect((h.lastQuery?.filter as { roles?: string[] }).roles).toBeUndefined();
  });

  it("omits stale organization ids when multi-org is disabled but still sends roles", () => {
    h.isMultiOrgEnabled = false;
    h.queryParams.organizationIds = ["org-1"];
    h.queryParams.roles = ["auditor"];
    render(<Users />);
    expect((h.lastQuery?.filter as { organizationIds?: string[] }).organizationIds).toBeUndefined();
    expect((h.lastQuery?.filter as { roles?: string[] }).roles).toEqual(["auditor"]);
  });

  it("omits stale organization ids and roles when no organizations are available", () => {
    h.organizations = [];
    h.queryParams.organizationIds = ["org-1"];
    h.queryParams.roles = ["auditor"];
    render(<Users />);
    expect((h.lastQuery?.filter as { organizationIds?: string[] }).organizationIds).toBeUndefined();
    expect((h.lastQuery?.filter as { roles?: string[] }).roles).toBeUndefined();
  });

  it("sends roles without organization options when multi-org is disabled", () => {
    h.isMultiOrgEnabled = false;
    h.organizations = [];
    h.queryParams.roles = ["auditor"];
    render(<Users />);

    expect((h.lastQuery?.filter as { organizationIds?: string[] }).organizationIds).toBeUndefined();
    expect((h.lastQuery?.filter as { roles?: string[] }).roles).toEqual(["auditor"]);
  });
});

// ── Bulk role selection ───────────────────────────────────────────────────────
// The gate exists because roles are stored per organization: a bulk change has
// nowhere to write until the list is narrowed to exactly one. These tests pin the
// three states of that gate and the lifecycle of a selection made under it.

const mkUser = (itemId: string, roles: string[] = []) => ({
  itemId,
  roles: { "org-1": roles },
});

const filteredToOneOrganization = () => {
  h.organizations = [
    { itemId: "org-1", name: "Org One" },
    { itemId: "org-2", name: "Org Two" },
  ];
  h.queryParams.organizationIds = ["org-1"];
  h.queryParams.name = "";
  h.queryParams.email = "";
};

const enterSelection = () => fireEvent.click(screen.getByTestId("users-select-trigger"));

const toggleAllOnPage = (checked: boolean) =>
  act(() => (h.tableProps?.onToggleAllOnPage as (v: boolean) => void)(checked));

const toggleUser = (itemId: string, checked: boolean) =>
  act(() => (h.tableProps?.onToggleUser as (id: string, v: boolean) => void)(itemId, checked));

describe("Users — bulk role selection gate", () => {
  it("hides Select entirely and explains what is missing when no filter is applied", () => {
    h.queryParams = {
      page: 0,
      pageSize: 10,
      "selected-filter": "name",
      name: "",
      email: "",
      organizationIds: [],
      roles: [],
    };
    render(<Users />);

    expect(screen.queryByTestId("users-select-trigger")).toBeNull();
    expect(screen.getByTestId("users-select-hint").textContent).toContain("one organization");
  });

  it("enables Select once a filter narrows the list to exactly one organization", () => {
    filteredToOneOrganization();
    render(<Users />);

    expect((screen.getByTestId("users-select-trigger") as HTMLButtonElement).disabled).toBe(false);
  });

  it("enables Select on a single-organization tenant, where the organization is always default", () => {
    // With multi-org off there is no organization choice anywhere in the flow, so a
    // plain search filter is enough to satisfy the gate.
    h.isMultiOrgEnabled = false;
    h.queryParams.name = "alice";
    h.queryParams.organizationIds = [];
    render(<Users />);

    expect((screen.getByTestId("users-select-trigger") as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders Select disabled with a reason when the filtered set still spans organizations", () => {
    // A role-only filter IS a filter, but it spans every organization -- so the
    // rule "show Select once a filter is applied" on its own would allow a
    // selection with nowhere to write.
    h.organizations = [
      { itemId: "org-1", name: "Org One" },
      { itemId: "org-2", name: "Org Two" },
      { itemId: "org-3", name: "Org Three" },
    ];
    h.queryParams.organizationIds = [];
    h.queryParams.roles = ["member"];
    h.queryParams.name = "alice";
    render(<Users />);

    const trigger = screen.getByTestId("users-select-trigger") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(screen.getByTestId("users-select-blocked-reason").textContent).toContain(
      "Selection spans 3 organizations",
    );

    fireEvent.click(trigger);
    expect(h.previewMutate).not.toHaveBeenCalled();
  });
});

describe("Users — selection lifecycle", () => {
  beforeEach(() => {
    filteredToOneOrganization();
    h.data = {
      data: [mkUser("u1", ["member"]), mkUser("u2", ["member", "viewer"])],
      totalCount: 2,
    };
  });

  it("locks the filter controls and shows no action bar until a row is ticked", () => {
    render(<Users />);
    enterSelection();

    expect(h.tableProps?.selectionMode).toBe(true);
    expect((screen.getByTestId("users-filter-controls") as HTMLFieldSetElement).disabled).toBe(
      true,
    );
    expect(screen.getByTestId("users-cancel-selection")).toBeTruthy();
    expect(screen.queryByTestId("users-selection-bar")).toBeNull();
  });

  it("shows the count and the padlocked organization once rows are ticked", () => {
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);

    expect(screen.getByTestId("users-selection-bar").textContent).toContain("1 selected");
    expect(screen.getByTestId("users-selection-organization").textContent).toContain("Org One");
  });

  it("names the default organization on a single-organization tenant", () => {
    h.isMultiOrgEnabled = false;
    h.queryParams.name = "alice";
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);

    expect(screen.getByTestId("users-selection-organization").textContent).toContain(
      "Default organization",
    );
  });

  it("offers the whole matching set once every row on the page is ticked", () => {
    h.data = { data: [mkUser("u1"), mkUser("u2")], totalCount: 312 };
    render(<Users />);
    enterSelection();
    toggleAllOnPage(true);

    expect(screen.getByTestId("users-selection-banner-page").textContent).toContain("312");
    expect(screen.getByTestId("users-selection-bar").textContent).toContain("2 selected");

    fireEvent.click(screen.getByTestId("users-select-all-matching"));

    expect(screen.getByTestId("users-selection-bar").textContent).toContain("312 selected");
    expect(screen.getByTestId("users-selection-banner-all").textContent).toContain(
      "310 not shown on this page",
    );
  });

  it("does not offer the escalation when the page already holds every match", () => {
    render(<Users />);
    enterSelection();
    toggleAllOnPage(true);

    expect(screen.queryByTestId("users-selection-banner-page")).toBeNull();
  });

  it("sends the filter itself, not an id list, once the whole matching set is taken", async () => {
    // Enumerating 312 ids client-side would mean paging the entire result set and
    // could drift between the enumeration and the submit.
    h.data = { data: [mkUser("u1"), mkUser("u2")], totalCount: 312 };
    render(<Users />);
    enterSelection();
    toggleAllOnPage(true);
    fireEvent.click(screen.getByTestId("users-select-all-matching"));
    fireEvent.click(screen.getByTestId("users-bulk-add-roles"));

    await act(async () => {
      await (h.dialogProps?.onContinue as (slugs: string[]) => Promise<void>)(["viewer"]);
    });

    const payload = h.previewMutate.mock.calls[0][0];
    expect(payload.target.userIds).toBeUndefined();
    expect(payload.target.filter.organizationIds).toEqual(["org-1"]);
    expect(payload.organizationId).toBe("org-1");
    expect(payload.addRoles).toEqual(["viewer"]);
    expect(payload.removeRoles).toEqual([]);
  });

  it("sends the ticked ids for an explicit selection", async () => {
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);
    toggleUser("u2", true);
    fireEvent.click(screen.getByTestId("users-bulk-remove-roles"));

    await act(async () => {
      await (h.dialogProps?.onContinue as (slugs: string[]) => Promise<void>)(["member"]);
    });

    const payload = h.previewMutate.mock.calls[0][0];
    expect(payload.target.userIds).toEqual(["u1", "u2"]);
    expect(payload.removeRoles).toEqual(["member"]);
    expect(payload.addRoles).toEqual([]);
  });

  it("hands the Remove dialog the roles held by the ticked users, with counts", () => {
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);
    toggleUser("u2", true);
    fireEvent.click(screen.getByTestId("users-bulk-remove-roles"));

    expect(h.dialogProps?.heldRoleCounts).toEqual({ member: 2, viewer: 1 });
  });

  it("hands the Remove dialog no held-role counts once the whole matching set is taken", () => {
    // Only this page of records is loaded, so "held by N of 312" would be a count of
    // the wrong population. The dialog degrades rather than guesses.
    h.data = { data: [mkUser("u1", ["member"]), mkUser("u2", ["member"])], totalCount: 312 };
    render(<Users />);
    enterSelection();
    toggleAllOnPage(true);
    fireEvent.click(screen.getByTestId("users-select-all-matching"));
    fireEvent.click(screen.getByTestId("users-bulk-remove-roles"));

    expect(h.dialogProps?.heldRoleCounts).toBeNull();
  });

  it("never lets the Add dialog see held counts, so no role is offered as pre-ticked", () => {
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);
    fireEvent.click(screen.getByTestId("users-bulk-add-roles"));

    expect(h.dialogProps?.heldRoleCounts).toBeNull();
  });

  it("exits selection mode on Cancel without firing a request", () => {
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);
    fireEvent.click(screen.getByTestId("users-bulk-cancel"));

    expect(h.tableProps?.selectionMode).toBe(false);
    expect(screen.queryByTestId("users-selection-bar")).toBeNull();
    expect(h.previewMutate).not.toHaveBeenCalled();
    expect(h.submitMutate).not.toHaveBeenCalled();
  });

  it("clears the selection when the list underneath it changes", () => {
    // The filter controls are locked while selecting, so this is the guard for a URL
    // edit or a back/forward step -- the paths that can move the list without asking.
    const view = render(<Users />);
    enterSelection();
    toggleUser("u1", true);
    expect(screen.getByTestId("users-selection-bar")).toBeTruthy();

    h.queryParams = { ...h.queryParams, page: 2 };
    view.rerender(<Users />);

    expect(screen.queryByTestId("users-selection-bar")).toBeNull();
    expect(h.tableProps?.selectionMode).toBe(false);
  });

  it("leaves selection mode if the gate stops being satisfied", () => {
    const view = render(<Users />);
    enterSelection();
    expect(h.tableProps?.selectionMode).toBe(true);

    h.queryParams = { ...h.queryParams, organizationIds: ["org-1", "org-2"] };
    view.rerender(<Users />);

    expect(h.tableProps?.selectionMode).toBe(false);
  });

  it("shows no action bar on an empty page", () => {
    h.data = { data: [], totalCount: 0 };
    render(<Users />);
    enterSelection();

    expect(screen.queryByTestId("users-selection-bar")).toBeNull();
    expect(screen.getByTestId("users-cancel-selection")).toBeTruthy();
  });
});

describe("Users — preview and submit", () => {
  beforeEach(() => {
    filteredToOneOrganization();
    h.data = { data: [mkUser("u1", ["member"])], totalCount: 1 };
  });

  const openReview = async () => {
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);
    fireEvent.click(screen.getByTestId("users-bulk-add-roles"));
    await act(async () => {
      await (h.dialogProps?.onContinue as (slugs: string[]) => Promise<void>)(["viewer"]);
    });
  };

  it("opens the review dialog with the preview response and closes the picker", async () => {
    await openReview();

    expect(screen.getByTestId("bulk-review-dialog")).toBeTruthy();
    expect(screen.queryByTestId("bulk-roles-dialog")).toBeNull();
    expect((h.reviewProps?.preview as { affectedCount: number }).affectedCount).toBe(309);
  });

  it("keeps the selection and opens no review dialog when the preview fails", async () => {
    h.previewMutate = vi.fn().mockRejectedValue({ errors: { Matched: "too broad" } });
    await openReview();

    expect(h.errorToast).toHaveBeenCalled();
    expect(screen.queryByTestId("bulk-review-dialog")).toBeNull();
    expect(screen.getByTestId("users-selection-bar").textContent).toContain("1 selected");
  });

  it("treats a well-formed rejection body as a failure too", async () => {
    h.previewMutate = vi.fn().mockResolvedValue({
      isSuccess: false,
      errors: { Roles: "At least one role to add or remove is required" },
    });
    await openReview();

    expect(h.errorToast).toHaveBeenCalled();
    expect(screen.queryByTestId("bulk-review-dialog")).toBeNull();
  });

  it("submits the same payload it previewed, then clears everything and toasts once", async () => {
    await openReview();
    await act(async () => {
      await (h.reviewProps?.onSubmit as () => Promise<void>)();
    });

    expect(h.submitMutate.mock.calls[0][0]).toEqual(h.previewMutate.mock.calls[0][0]);
    expect(h.successToast).toHaveBeenCalledTimes(1);
    expect(h.successToast.mock.calls[0][0].description).toContain("background");
    expect(screen.queryByTestId("bulk-review-dialog")).toBeNull();
    expect(screen.queryByTestId("users-selection-bar")).toBeNull();
    expect(h.tableProps?.selectionMode).toBe(false);
  });

  it("keeps the review dialog and the selection when the submit fails", async () => {
    h.submitMutate = vi.fn().mockRejectedValue({ errors: { Queue: "broker down" } });
    await openReview();
    await act(async () => {
      await (h.reviewProps?.onSubmit as () => Promise<void>)();
    });

    expect(h.errorToast).toHaveBeenCalled();
    expect(h.successToast).not.toHaveBeenCalled();
    expect(screen.getByTestId("bulk-review-dialog")).toBeTruthy();
    expect(screen.getByTestId("users-selection-bar")).toBeTruthy();
  });

  it("disables the action bar while a request is in flight", () => {
    h.isPreviewPending = true;
    render(<Users />);
    enterSelection();
    toggleUser("u1", true);

    expect((screen.getByTestId("users-bulk-add-roles") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("users-bulk-remove-roles") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
