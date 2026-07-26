import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10 },
}));

vi.mock("@blocks-identifier/hooks/use-services", () => ({
  useGetAllServices: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsInteger: parser,
    useQueryStates: () => [h.queryParams, h.setQueryParams],
  };
});
vi.mock("@blocks-identifier/components/service-card/service-card", () => ({
  ServiceCard: ({ service }: { service: { name: string } }) => (
    <div data-testid="service-card">{service.name}</div>
  ),
}));

import { ServiceList } from "./service-list";

describe("ServiceList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.queryParams = { page: 0, pageSize: 10 };
    h.data = { data: [{ itemId: "s1", name: "Orders" }], totalCount: 1 };
  });

  it("renders the skeleton while loading", () => {
    h.isLoading = true;
    render(<ServiceList />);
    expect(screen.queryByTestId("service-card")).toBeNull();
  });

  it("renders the empty state when there are no services", () => {
    h.data = { data: [], totalCount: 0 };
    render(<ServiceList />);
    expect(screen.getByText("No services yet")).toBeTruthy();
  });

  it("renders a service card for each service", () => {
    render(<ServiceList />);
    expect(screen.getByTestId("service-card")).toBeTruthy();
    expect(screen.getByText("Orders")).toBeTruthy();
  });

  it("shows pagination once the total exceeds the page size", () => {
    h.data = { data: [{ itemId: "s1", name: "Orders" }], totalCount: 25 };
    render(<ServiceList />);
    expect(screen.getByText(/Page 1 of/)).toBeTruthy();
  });
});
