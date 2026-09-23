import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";

const h = vi.hoisted(() => ({
  data: [] as IDataGatewayConfiguration[] | undefined,
  isLoading: false,
  isFetching: false,
}));

vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));

vi.mock("@/cross-modules/data-gateway/hooks/use-data-gateway-configuration", () => ({
  useGetDataGatewayConfigurations: () => ({
    data: h.data,
    isLoading: h.isLoading,
    isFetching: h.isFetching,
  }),
}));

vi.mock(
  "../data-gateway-configuration/save-data-gateway-configuration/save-data-gateway-configuration",
  () => ({
    SaveDataGatewayConfiguration: ({ configuration }: { configuration?: { itemId: string } }) => (
      <div data-testid="save-config">{configuration ? `editing:${configuration.itemId}` : "add"}</div>
    ),
  }),
);

import { DataGatewayContents } from "./data-gateway-contents";

const config = (
  over: Partial<IDataGatewayConfiguration> = {},
): IDataGatewayConfiguration =>
  ({
    itemId: "id-1",
    projectKey: "project-key-1",
    projectShortKey: "proj1",
    connectionString: "********",
    databaseName: "project_one_db",
    isCollectionNameEditable: false,
    collectionNamePattern: "sb_{SchemaName}s",
    isDeleted: false,
    analyticsConfiguration: { enableAnalytics: false, enableDate: null, validTill: null },
    ...over,
  }) as IDataGatewayConfiguration;

describe("DataGatewayContents", () => {
  beforeEach(() => {
    h.data = [];
    h.isLoading = false;
    h.isFetching = false;
  });

  it("shows loading skeletons while configurations are loading", () => {
    h.isLoading = true;
    const { container } = render(<DataGatewayContents />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("project-key-1")).toBeNull();
  });

  it("renders the empty state when no configuration exists", () => {
    h.data = [];
    render(<DataGatewayContents />);
    expect(screen.getByText("No DataGateway configurations yet")).toBeTruthy();
  });

  it("lists project key, database name, masked connection string, and analytics status", () => {
    h.data = [
      config({
        itemId: "id-1",
        projectKey: "project-key-1",
        databaseName: "project_one_db",
        connectionString: "********",
        analyticsConfiguration: { enableAnalytics: true, enableDate: null, validTill: null },
      }),
      config({
        itemId: "id-2",
        projectKey: "project-key-2",
        databaseName: "project_two_db",
        connectionString: "********",
        analyticsConfiguration: { enableAnalytics: false, enableDate: null, validTill: null },
      }),
    ];
    render(<DataGatewayContents />);

    expect(screen.getByText("project-key-1")).toBeTruthy();
    expect(screen.getByText("project_one_db")).toBeTruthy();
    expect(screen.getAllByText("********").length).toBe(2);
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("opens the dialog in add mode when the Add Configuration button is clicked", async () => {
    const user = userEvent.setup();
    h.data = [config({ itemId: "id-9", projectKey: "project-key-9" })];
    render(<DataGatewayContents />);

    // Start from edit mode, then confirm Add resets it back - the save dialog is always mounted
    // (only Radix's internal open state toggles), so the only observable signal is which
    // configuration, if any, was handed to it.
    await user.click(screen.getByRole("button", { name: "Edit configuration" }));
    expect(screen.getByTestId("save-config").textContent).toBe("editing:id-9");

    await user.click(screen.getByRole("button", { name: /Add Configuration/i }));
    expect(screen.getByTestId("save-config").textContent).toBe("add");
  });

  it("opens the dialog in edit mode for the selected configuration's row", async () => {
    const user = userEvent.setup();
    h.data = [config({ itemId: "id-9", projectKey: "project-key-9" })];
    render(<DataGatewayContents />);

    await user.click(screen.getByRole("button", { name: "Edit configuration" }));
    expect(screen.getByTestId("save-config").textContent).toBe("editing:id-9");
  });
});
