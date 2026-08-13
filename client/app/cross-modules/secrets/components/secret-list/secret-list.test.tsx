import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { SECRET_STATUS, SECRET_TYPE } from "@/cross-modules/secrets/models/secret.model";
import type { SecretListResult } from "@/cross-modules/secrets/models/secret.model";
import { makeSecret } from "@/cross-modules/secrets/test-utils/secret.fixtures";

const hoisted = vi.hoisted(() => ({
  state: {
    data: undefined as SecretListResult | undefined,
    isLoading: false,
    isFetching: false,
    error: null as unknown,
  },
  lastFilter: undefined as unknown,
}));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useFindSecrets: (filter: unknown) => {
    hoisted.lastFilter = filter;
    return hoisted.state;
  },
}));

// The row is covered by its own suite; here only its presence and count matter.
vi.mock("../secret-row/secret-row", () => ({
  SecretRow: ({ secret }: { secret: { secretId: string; name: string } }) => (
    <tr data-testid="secret-row">
      <td>{secret.name}</td>
    </tr>
  ),
}));

import { SecretList } from "./secret-list";

const renderList = (searchParams = "") =>
  render(
    <NuqsTestingAdapter searchParams={searchParams}>
      <SecretList />
    </NuqsTestingAdapter>,
  );

describe("SecretList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.state = { data: undefined, isLoading: false, isFetching: false, error: null };
  });

  it("renders the documented columns", () => {
    hoisted.state.data = { data: [], totalCount: 0 };
    renderList();
    // Scoped to the table: the toolbar also has "Type" and "Status" controls.
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "",
      "Secret",
      "Type",
      "Status",
      "Created On",
      "Actions",
    ]);
  });

  it("never renders a key count or vault coordinates", () => {
    // None of these exist in the API; the old model's key-value bag is gone entirely.
    hoisted.state.data = { data: [makeSecret()], totalCount: 1 };
    renderList();
    expect(screen.queryByText(/^\d+\s+keys?$/i)).toBeNull();
    expect(screen.queryByText(/key vault/i)).toBeNull();
    expect(screen.queryByText(/managed by/i)).toBeNull();
    expect(screen.queryByText(/resource reference/i)).toBeNull();
  });

  it("renders a row per secret", () => {
    hoisted.state.data = {
      data: [makeSecret(), makeSecret({ secretId: "b", name: "other-key" })],
      totalCount: 2,
    };
    renderList();
    expect(screen.getAllByTestId("secret-row")).toHaveLength(2);
  });

  it("shows a skeleton while loading", () => {
    hoisted.state.isLoading = true;
    renderList();
    expect(screen.queryAllByTestId("secret-row")).toHaveLength(0);
  });

  it("invites the user to create one when there are no secrets at all", () => {
    hoisted.state.data = { data: [], totalCount: 0 };
    renderList();
    expect(screen.getByText("No secrets yet")).toBeTruthy();
  });

  it("suggests clearing filters when a filtered search finds nothing", () => {
    hoisted.state.data = { data: [], totalCount: 0 };
    renderList("?secretSearch=nothing");
    expect(screen.getByText("No matching secrets")).toBeTruthy();
    expect(screen.getByText(/clear the filters/i)).toBeTruthy();
  });

  describe("filters to request mapping", () => {
    it("defaults to page one with no type or status filter", () => {
      hoisted.state.data = { data: [], totalCount: 0 };
      renderList();
      expect(hoisted.lastFilter).toEqual({ pageNumber: 1, pageSize: 10 });
    });

    it("sends lowercase type and status wire values", () => {
      hoisted.state.data = { data: [], totalCount: 0 };
      renderList("?secretType=api&secretStatus=locked");
      expect(hoisted.lastFilter).toEqual({
        type: SECRET_TYPE.Api,
        status: SECRET_STATUS.Locked,
        pageNumber: 1,
        pageSize: 10,
      });
    });

    it("opts into deleted rows only when filtering for them", () => {
      // Deleted secrets are excluded server-side unless asked for.
      hoisted.state.data = { data: [], totalCount: 0 };
      renderList("?secretStatus=deleted");
      expect(hoisted.lastFilter).toMatchObject({
        status: SECRET_STATUS.Deleted,
        includeDeleted: true,
      });
    });

    it("does not include deleted rows for the active filter", () => {
      hoisted.state.data = { data: [], totalCount: 0 };
      renderList("?secretStatus=active");
      expect(hoisted.lastFilter).not.toHaveProperty("includeDeleted");
    });

    it("converts the zero-based page control to the one-based wire value", () => {
      hoisted.state.data = { data: [], totalCount: 40 };
      renderList("?secretPage=2&secretPageSize=20");
      expect(hoisted.lastFilter).toMatchObject({ pageNumber: 3, pageSize: 20 });
    });

    it("restores filters from the URL on reload", () => {
      hoisted.state.data = { data: [], totalCount: 0 };
      renderList("?secretSearch=gateway&secretType=service");
      expect(hoisted.lastFilter).toMatchObject({ search: "gateway", type: SECRET_TYPE.Service });
    });
  });

  describe("pagination", () => {
    it("is hidden when everything fits on one page", () => {
      hoisted.state.data = { data: [makeSecret()], totalCount: 1 };
      renderList();
      expect(screen.queryByText(/^Page \d+ of/)).toBeNull();
    });

    it("reports the server-side total across pages", () => {
      hoisted.state.data = { data: [makeSecret()], totalCount: 35 };
      renderList();
      expect(screen.getByText("Page 1 of 4")).toBeTruthy();
    });
  });

  describe("error states", () => {
    it("frames a 403 as unavailable for this account, not as a crash", () => {
      // Routine outcome: until secret permissions are seeded for a tenant, every endpoint 403s.
      hoisted.state.error = Object.assign(new Error("denied"), { status: 403, errors: {} });
      renderList();
      expect(screen.getByText("Not available for your account")).toBeTruthy();
      expect(screen.getByText(/do not have permission/i)).toBeTruthy();
    });

    it("reports a vault outage in the backend's own generic wording", () => {
      hoisted.state.error = Object.assign(new Error("gateway"), { status: 502, errors: {} });
      renderList();
      expect(screen.getByText(/secret store is currently unavailable/i)).toBeTruthy();
    });
  });

  it("keeps the toolbar available alongside an error", () => {
    hoisted.state.error = Object.assign(new Error("denied"), { status: 403, errors: {} });
    renderList();
    // The search box stays usable so the user can back out of a filter that produced the error.
    // FilterToolbar renders a desktop and a mobile view, hence the plural query.
    expect(
      screen.getAllByPlaceholderText(/Search by name, description or secret ID/i).length,
    ).toBeGreaterThan(0);
  });
});
