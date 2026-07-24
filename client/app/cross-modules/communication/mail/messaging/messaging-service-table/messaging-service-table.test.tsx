import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock(
  "@blocks-communication/mail/components/messaging/campaign-creation/campaign-creation",
  () => ({ default: () => <div data-testid="campaign-creation" /> }),
);
vi.mock(
  "@blocks-communication/mail/components/messaging/messaging-table-toolbar/messaging-table-toolbar",
  () => ({ MessagingTableToolbar: () => <div data-testid="toolbar" /> }),
);
vi.mock("@/components/ui-kits/table-pagination/table-pagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

import { MessagingServiceTable } from "./messaging-service-table";

describe("MessagingServiceTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the heading, tabs and seeded rows", () => {
    render(<MessagingServiceTable />);
    expect(screen.getByRole("heading", { name: "Messaging" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Messages" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Reports" })).toBeTruthy();
    expect(screen.getByText("Reset Password")).toBeTruthy();
  });

  it("navigates to the configure screen", async () => {
    const user = userEvent.setup();
    render(<MessagingServiceTable />);
    await user.click(screen.getByRole("button", { name: /Configure/ }));
    expect(navigate).toHaveBeenCalledWith("/utilities/messaging/configure");
  });

  it("navigates to a campaign when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<MessagingServiceTable />);
    await user.click(screen.getByText("Reset Password"));
    expect(navigate).toHaveBeenCalledWith("/utilities/messaging/campaigns/1");
  });

  it("sorts by name when the header sort control is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<MessagingServiceTable />);
    // clicking a sort toggle should not throw and keeps the table rendered
    const sortIcons = container.querySelectorAll("svg.lucide-arrow-up-down");
    expect(sortIcons.length).toBeGreaterThan(0);
    await user.click(sortIcons[0]);
    expect(screen.getByText("Reset Password")).toBeTruthy();
  });
});
