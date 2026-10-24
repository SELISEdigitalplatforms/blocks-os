import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StorageDetailsDrawer } from "./storage-details-drawer";

const storage = (over: Record<string, unknown> = {}) =>
  ({
    name: "Prod bucket",
    storageStrategy: "AWS",
    createdBy: "alice",
    createdDate: "2025-01-01T00:00:00Z",
    lastUpdatedDate: "2025-02-01T00:00:00Z",
    ...over,
  }) as never;

describe("StorageDetailsDrawer", () => {
  it("renders nothing when there is no storage", () => {
    const { container } = render(
      <StorageDetailsDrawer open onOpenChange={vi.fn()} storage={null} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders the storage properties and provider label", () => {
    render(<StorageDetailsDrawer open onOpenChange={vi.fn()} storage={storage()} />);
    expect(screen.getByText("Prod bucket")).toBeTruthy();
    expect(screen.getByText("AWS")).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("Configured")).toBeTruthy();
  });

  it("labels an S3-compatible provider and defaults the owner", () => {
    render(
      <StorageDetailsDrawer
        open
        onOpenChange={vi.fn()}
        storage={storage({ storageStrategy: "S3Compatible", createdBy: "" })}
      />,
    );
    expect(screen.getByText("AWS S3 Compatible")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();
  });

  it("labels an SFTP provider", () => {
    render(
      <StorageDetailsDrawer
        open
        onOpenChange={vi.fn()}
        storage={storage({ storageStrategy: "SftpStorage" })}
      />,
    );
    expect(screen.getByText("SFTP")).toBeTruthy();
  });

  it("shows each provider secret by status only, with a repair hint when it is broken", () => {
    render(
      <StorageDetailsDrawer
        open
        onOpenChange={vi.fn()}
        storage={storage({
          storageStrategy: "SftpStorage",
          passwordStatus: "active",
          sftpSecretKeyStatus: "archived",
        })}
      />,
    );
    expect(screen.getByText("Password")).toBeTruthy();
    expect(screen.getByText("Set")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
    expect(
      screen.getByText("Delete this configuration and add it again with a new secret."),
    ).toBeTruthy();
    // Only the secrets the provider uses are listed.
    expect(screen.queryByText("Connection String")).toBeNull();
  });

  it("closes the drawer when the close button is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<StorageDetailsDrawer open onOpenChange={onOpenChange} storage={storage()} />);
    await user.click(screen.getByText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
