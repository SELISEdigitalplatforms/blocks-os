import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import {
  SECRET_STATUS,
  SECRET_TAG_MAX_PER_FILTER,
  SECRET_TYPE,
} from "@/cross-modules/secrets/models/secret.model";

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useSecretTags: () => ({
    data: [
      { key: "iam", label: "Blocks Iam" },
      { key: "os", label: "Blocks Logic" },
    ],
    isLoading: false,
  }),
}));

import { SecretToolbar, useSecretFilterQueryParams } from "./secret-toolbar";

const withParams = (searchParams: string) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <NuqsTestingAdapter searchParams={searchParams}>{children}</NuqsTestingAdapter>
  );
  Wrapper.displayName = "NuqsWrapper";
  return Wrapper;
};

const readFilter = (searchParams = "") =>
  renderHook(() => useSecretFilterQueryParams(), { wrapper: withParams(searchParams) }).result
    .current;

describe("useSecretFilterQueryParams", () => {
  it("defaults to the first page with no filters", () => {
    expect(readFilter().filter).toEqual({ pageNumber: 1, pageSize: 10 });
  });

  it("omits blank filters rather than sending empty values", () => {
    // `SecretFilter.Type` is nullable server-side; `type=""` is not the same as "no filter".
    const { filter } = readFilter("?secretSearch=&secretType=&secretStatus=");
    expect(filter).toEqual({ pageNumber: 1, pageSize: 10 });
  });

  it("carries lowercase wire values through", () => {
    const { filter } = readFilter("?secretType=api&secretStatus=locked");
    expect(filter.type).toBe(SECRET_TYPE.Api);
    expect(filter.status).toBe(SECRET_STATUS.Locked);
  });

  it("sets includeDeleted only for the deleted filter", () => {
    expect(readFilter("?secretStatus=deleted").filter.includeDeleted).toBe(true);
    expect(readFilter("?secretStatus=active").filter.includeDeleted).toBeUndefined();
    expect(readFilter().filter.includeDeleted).toBeUndefined();
  });

  it("translates the zero-based page control to the one-based wire value", () => {
    expect(readFilter("?secretPage=0").filter.pageNumber).toBe(1);
    expect(readFilter("?secretPage=4").filter.pageNumber).toBe(5);
  });

  it("sends the selected tags as an array", () => {
    // Any-of on the server, so a second chip widens the result rather than narrowing it.
    expect(readFilter("?secretTags=iam,os").filter.tags).toEqual(["iam", "os"]);
  });

  it("omits the tag filter when nothing is selected", () => {
    expect(readFilter().filter.tags).toBeUndefined();
  });

  it("trims the tag filter to the server cap rather than sending over it", () => {
    // Sending more would 400 the whole list instead of just ignoring the extra chips.
    const tags = Array.from({ length: SECRET_TAG_MAX_PER_FILTER + 3 }, (_, i) => `tag-${i}`);
    const { filter } = readFilter(`?secretTags=${tags.join(",")}`);
    expect(filter.tags).toHaveLength(SECRET_TAG_MAX_PER_FILTER);
  });

  it("exposes the raw values for the toolbar controls", () => {
    expect(readFilter("?secretSearch=gateway&secretType=service").values).toEqual({
      search: "gateway",
      type: "service",
      status: "",
      tags: [],
    });
  });
});

describe("SecretToolbar", () => {
  const renderToolbar = (searchParams = "") =>
    render(
      <NuqsTestingAdapter searchParams={searchParams}>
        <SecretToolbar />
      </NuqsTestingAdapter>,
    );

  it("offers search, type and status controls", () => {
    renderToolbar();
    expect(
      screen.getAllByPlaceholderText(/Search by name or ID/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Type/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Status/ }).length).toBeGreaterThan(0);
  });

  it("shows a reset control once a filter is applied", () => {
    renderToolbar("?secretType=api");
    expect(screen.getAllByRole("button", { name: /Reset/ }).length).toBeGreaterThan(0);
  });

  it("hides the reset control when nothing is filtered", () => {
    renderToolbar();
    expect(screen.queryAllByRole("button", { name: /Reset/ })).toHaveLength(0);
  });

  it("clears every filter on reset", async () => {
    const user = userEvent.setup();
    renderToolbar("?secretSearch=gateway&secretType=api&secretStatus=locked");

    await user.click(screen.getAllByRole("button", { name: /Reset/ })[0]);

    expect(screen.queryAllByRole("button", { name: /Reset/ })).toHaveLength(0);
  });
});
