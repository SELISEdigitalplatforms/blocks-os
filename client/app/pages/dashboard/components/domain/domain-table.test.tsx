import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsync, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/hooks/use-project", () => ({
  useUpdateProject: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@seliseblocks/genesis-os/utils", () => ({ showErrorToast, showSuccessToast }));
vi.mock("@seliseblocks/genesis-os/components", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RenderConditionally: ({ condition, children }: { condition: boolean; children: React.ReactNode }) =>
    condition ? <>{children}</> : null,
}));
vi.mock("./domain-form-dialog", () => ({
  DomainFormDialog: ({ open }: { open: boolean }) => (
    <div data-testid="domain-form" data-open={String(open)} />
  ),
}));
vi.mock("../cname/dialog", () => ({
  CnameValidatorDialog: ({ open, domain }: { open: boolean; domain?: { domain: string } }) => (
    <div data-testid="cname-dialog" data-open={String(open)} data-domain={domain?.domain ?? ""} />
  ),
}));

import { DomainTable } from "./domain-table";
import type { IDomain } from "@seliseblocks/genesis-os/models";

const domains = [
  { domain: "verified.com", isDomainVerified: true, cookieDomain: ".verified.com" },
  { domain: "pending.com", isDomainVerified: false, cookieDomain: ".pending.com" },
] as unknown as IDomain[];

describe("DomainTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row per domain with status badges", () => {
    render(<DomainTable data={domains} />);
    expect(screen.getByText("verified.com")).toBeTruthy();
    expect(screen.getByText("pending.com")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText("Unverified")).toBeTruthy();
  });

  it("renders an empty state when there are no domains", () => {
    render(<DomainTable data={[]} />);
    expect(screen.getByText("No domains configured yet.")).toBeTruthy();
  });

  it("only shows configure and CNAME actions for unverified domains", () => {
    render(<DomainTable data={domains} />);
    // one Configure and one Validate CNAME (for pending.com only)
    expect(screen.getAllByTitle("Configure domain")).toHaveLength(1);
    expect(screen.getAllByTitle("Validate CNAME")).toHaveLength(1);
    // both rows have a delete button
    expect(screen.getAllByTitle("Delete domain")).toHaveLength(2);
  });

  it("opens the edit dialog when configure is clicked", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getByTitle("Configure domain"));
    expect(screen.getByTestId("domain-form").getAttribute("data-open")).toBe("true");
  });

  it("opens the CNAME dialog with the resolved domain", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getByTitle("Validate CNAME"));
    expect(screen.getByTestId("cname-dialog").getAttribute("data-open")).toBe("true");
    expect(screen.getByTestId("cname-dialog").getAttribute("data-domain")).toBe("pending.com");
  });

  it("deletes a domain after confirmation and shows a success toast", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ action: 2, applicationDomain: "verified.com" }),
      ),
    );
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it("keeps the shared API host unless the option is ticked", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ deleteSharedApiHost: false }),
      ),
    );
  });

  it("removes the shared API host when the option is ticked", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ deleteSharedApiHost: true }),
      ),
    );
  });

  it("names the shared API host and who it affects", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    expect(await screen.findByText("blocksapi.verified.com")).toBeTruthy();
    expect(screen.getByText(/other projects you may not be able to see/)).toBeTruthy();
  });

  it("states that the certificate is removed rather than asking", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    expect(await screen.findByText(/SSL certificate are removed from the proxy/)).toBeTruthy();
  });

  it("does not offer the shared API host option for an unverified domain", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    // Second row is pending.com — nothing was ever put on the proxy for it.
    await user.click(screen.getAllByTitle("Delete domain")[1]);
    await screen.findByRole("button", { name: "Delete" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("does not offer the shared API host option for a platform-hosted domain", async () => {
    const user = userEvent.setup();
    const platform = [
      { domain: "https://xyz.slsblx.com", isDomainVerified: true, cookieDomain: "slsblx.com" },
    ] as unknown as IDomain[];
    render(<DomainTable data={platform} />);
    await user.click(screen.getByTitle("Delete domain"));
    await screen.findByRole("button", { name: "Delete" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("resets the shared API host choice between domains", async () => {
    mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);

    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // A box ticked for one domain must not carry over to the next one deleted.
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    expect((await screen.findByRole("checkbox")).getAttribute("data-state")).toBe("unchecked");
  });

  it("shows an error toast when deletion returns a failure", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "no" } });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });

  it("shows an error toast when deletion throws", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Failed to delete domain" }),
    );
  });
});
