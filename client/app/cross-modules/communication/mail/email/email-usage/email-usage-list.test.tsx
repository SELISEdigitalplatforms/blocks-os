import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailUsage } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  data: undefined as { data: IEmailUsage[]; totalCount: number } | undefined,
  isLoading: false,
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, search: "", status: "", startDate: "", endDate: "" },
}));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({ useScopedPath: () => (p: string) => `/s/${p}` }));
vi.mock("@blocks-communication/mail/hooks/use-email-usage", () => ({
  useGetEmailUsage: () => ({ data: h.data, isLoading: h.isLoading }),
}));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-filter-toolbar", () => ({
  EmailUsageFilterToolbar: ({ isInbound }: { isInbound: boolean }) => (
    <div data-testid="usage-filter">{String(isInbound)}</div>
  ),
  useEmailUsageFilterQueryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
}));
vi.mock("@blocks-communication/mail/email/email-usage/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>status:{status}</span>,
}));

import { EmailUsageList } from "./email-usage-list";

const row = (over: Partial<IEmailUsage> = {}): IEmailUsage =>
  ({
    messageId: "m-1",
    from: "a@x.com",
    to: "b@x.com",
    subject: "Hello",
    status: "Delivered",
    date: "2024-06-01T10:00:00.000Z",
    ...over,
  }) as IEmailUsage;

const renderList = (isInbound: boolean) =>
  render(
    <MemoryRouter>
      <EmailUsageList isInbound={isInbound} />
    </MemoryRouter>,
  );

describe("EmailUsageList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.data = { data: [row()], totalCount: 1 };
    h.isLoading = false;
    h.queryParams = { page: 0, pageSize: 10, search: "", status: "", startDate: "", endDate: "" };
  });

  it("shows the loading skeleton while fetching", () => {
    h.isLoading = true;
    const { container } = renderList(false);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders outbound rows with a Status column and Send Date header", () => {
    renderList(false);
    expect(screen.getByText("Send Date")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("status:Delivered")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByTestId("usage-filter").textContent).toBe("false");
  });

  it("hides the Status column and uses the Received Date header for inbound", () => {
    renderList(true);
    expect(screen.getByText("Received Date")).toBeTruthy();
    expect(screen.queryByText("Status")).toBeNull();
  });

  it("renders an empty state when there are no rows", () => {
    h.data = { data: [], totalCount: 0 };
    renderList(false);
    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("renders pagination when the total count exceeds the page size", () => {
    h.data = { data: [row()], totalCount: 40 };
    renderList(false);
    expect(screen.getByText(/Page 1 of/)).toBeTruthy();
    expect(screen.getByText("Showing 1–10 of 40")).toBeTruthy();
  });

  it("shows the sender's display name, address and a body preview for inbound", () => {
    h.data = {
      data: [
        row({
          from: '"Abdullah Al Momen" <momen@gmail.com>',
          subject: "inbound test 1",
          body: "Test **Inbound** [link](https://x.io)",
        }),
      ],
      totalCount: 1,
    };
    renderList(true);
    expect(screen.getByText("Abdullah Al Momen")).toBeTruthy();
    expect(screen.getByText("momen@gmail.com")).toBeTruthy();
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.getByText("Test Inbound link")).toBeTruthy();
  });

  it("opens the details page, with the message id encoded, when a row is clicked", async () => {
    h.data = { data: [row({ messageId: "CAP+abc@mail.gmail.com" })], totalCount: 1 };
    const Details = () => <div>details:{useParams().id}</div>;
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<EmailUsageList isInbound />} />
          <Route path="/s/email-management/usage/:id" element={<Details />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("link", { name: "Open Hello" }));

    expect(await screen.findByText("details:CAP+abc@mail.gmail.com")).toBeTruthy();
  });
});
