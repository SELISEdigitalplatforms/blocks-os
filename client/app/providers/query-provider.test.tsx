import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

// Devtools render nothing meaningful in jsdom; stub to keep the tree clean.
vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => null,
}));

import QueryProvider, { getQueryClient } from "./query-provider";

function DataConsumer() {
  const { data } = useQuery({
    queryKey: ["provider-test"],
    queryFn: () => Promise.resolve("hello from query"),
  });
  return <div>{data ?? "loading"}</div>;
}

describe("QueryProvider", () => {
  it("renders children", () => {
    render(
      <QueryProvider>
        <div>child content</div>
      </QueryProvider>,
    );
    expect(screen.getByText("child content")).toBeTruthy();
  });

  it("provides a working QueryClient to descendants", async () => {
    render(
      <QueryProvider>
        <DataConsumer />
      </QueryProvider>,
    );
    await waitFor(() => expect(screen.getByText("hello from query")).toBeTruthy());
  });

  it("returns a stable singleton query client", () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });
});
