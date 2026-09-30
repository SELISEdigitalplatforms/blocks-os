import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IIntegrationConnection } from "@/cross-modules/integration/models/integration.model";

const connection = (overrides: Partial<IIntegrationConnection> = {}): IIntegrationConnection => ({
  itemId: "conn-1",
  connectionName: "WordPress",
  templateKey: "localization-full",
  templateDisplayName: "Localization Full",
  templateAccessLevel: "full",
  roleId: "role-1",
  roleSlug: "localization-integrator",
  clientCredentialId: "client-1",
  createdDate: "2026-09-30T10:00:00Z",
  createdBy: "u1",
  siteUrl: "https://site.example.com",
  source: "manual",
  status: "active",
  ...overrides,
});

type Props = {
  connections?: IIntegrationConnection[];
  onDisconnect?: (connectionId: string) => void;
  onRegenerate?: (connection: IIntegrationConnection) => void;
};

const mountList = async ({ connections, onDisconnect = vi.fn(), onRegenerate = vi.fn() }: Props = {}) => {
  const { IntegrationConnectionList } = await import("@/cross-modules/integration/components/integration-connection-list");
  return render(
    <IntegrationConnectionList
      connections={connections ?? [connection()]}
      onDisconnect={onDisconnect}
      onRegenerate={onRegenerate}
      disconnecting={false}
      regenerating={false}
    />,
  );
};

describe("IntegrationConnectionList", () => {
  it("shows the row metadata: name, access level, status, source, client id, site and created date", async () => {
    await mountList();

    expect(screen.getByText("WordPress")).toBeTruthy();
    expect(screen.getByText("Full")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText(/Client ID client-1/)).toBeTruthy();
    expect(screen.getByText(/site\.example\.com/)).toBeTruthy();
    const row = screen.getByTestId("integration-connection-row");
    expect(within(row).getByText(/Created/)).toBeTruthy();
  });

  it("labels a revoked connection without action buttons", async () => {
    await mountList({ connections: [connection({ status: "revoked" })] });

    expect(screen.getByText("revoked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
  });

  it("flags an active credential whose initial secret was never delivered and still allows disconnect", async () => {
    await mountList({ connections: [connection({ neverDelivered: true })] });

    expect(screen.getByText("Never delivered")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("asks for confirmation before disconnecting and reports the connection id", async () => {
    const onDisconnect = vi.fn();
    await mountList({ onDisconnect });

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByText("Disconnect this connection?")).toBeTruthy();
    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" }).at(-1)!);
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith("conn-1"));
  });

  it("asks for confirmation before regenerating and passes the whole connection", async () => {
    const onRegenerate = vi.fn();
    await mountList({ onRegenerate });

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(await screen.findByText("Regenerate the secret?")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Regenerate" }).at(-1)!);
    await waitFor(() => expect(onRegenerate).toHaveBeenCalledWith(expect.objectContaining({ itemId: "conn-1" })));
  });
});
