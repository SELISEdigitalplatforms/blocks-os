import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";

const h = vi.hoisted(() => ({
  data: undefined as IDataGatewayConfiguration | null | undefined,
  isLoading: false,
  mutateAsync: vi.fn(),
  isSavePending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/cross-modules/data-gateway/hooks/use-data-gateway-configuration", () => ({
  useGetDataGatewayConfiguration: () => ({ data: h.data, isLoading: h.isLoading }),
  useSaveDataGatewayConfiguration: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isSavePending,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { DataGatewayContents } from "./data-gateway-contents";

const config = (
  over: Partial<IDataGatewayConfiguration> = {},
): IDataGatewayConfiguration =>
  ({
    itemId: "id-1",
    projectKey: "project-key-1",
    projectShortKey: "proj1",
    connectionString: "mongodb://localhost:27017",
    databaseName: "project_one_db",
    isCollectionNameEditable: false,
    collectionNamePattern: "sb_{SchemaName}s",
    isDeleted: false,
    analyticsConfiguration: { enableAnalytics: false, enableDate: null, validTill: null },
    ...over,
  }) as IDataGatewayConfiguration;

describe("DataGatewayContents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.data = undefined;
    h.isLoading = false;
    h.isSavePending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("shows a spinner while the configuration is loading", () => {
    h.isLoading = true;
    render(<DataGatewayContents />);
    expect(screen.queryByText("Data Source")).toBeNull();
  });

  it("defaults to Blocks database when no configuration exists yet, hiding the custom fields", () => {
    h.data = undefined;
    render(<DataGatewayContents />);

    expect(screen.getByText("Blocks database")).toBeTruthy();
    expect(screen.queryByPlaceholderText("my-database")).toBeNull();
    // Blocks database is a valid selection on its own - Save starts enabled.
    expect(
      (screen.getByRole("button", { name: "Save Changes" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("selects My data sources and pre-fills the real connection details for a custom configuration", () => {
    h.data = config({
      connectionString: "mongodb://custom-host:27017",
      databaseName: "custom_db",
    });
    render(<DataGatewayContents />);

    expect(
      (screen.getByPlaceholderText("mongodb://<username>:<password>@host:27017/db") as HTMLInputElement)
        .value,
    ).toBe("mongodb://custom-host:27017");
    expect((screen.getByPlaceholderText("my-database") as HTMLInputElement).value).toBe(
      "custom_db",
    );
  });

  it("saves a brand new Blocks-managed configuration with the default sentinel", async () => {
    const user = userEvent.setup();
    h.data = undefined;
    render(<DataGatewayContents />);

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      connectionString: "default",
      databaseName: "default",
      isCollectionNameEditable: false,
      collectionNamePattern: "sb_{SchemaName}s",
      enableAnalytics: false,
      projectKey: "tenant-1",
      updateRequest: false,
    });
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration created successfully",
    });
  });

  it("requires a connection string and database name before saving a custom source", async () => {
    const user = userEvent.setup();
    h.data = undefined;
    render(<DataGatewayContents />);

    await user.click(screen.getByRole("radio", { name: /My data sources/i }));

    expect(
      (screen.getByRole("button", { name: "Save Changes" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("submits an update payload identified by itemId when a configuration already exists", async () => {
    const user = userEvent.setup();
    h.data = config({ itemId: "dg-5" });
    render(<DataGatewayContents />);

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      itemId: "dg-5",
      connectionString: "mongodb://localhost:27017",
      databaseName: "project_one_db",
      updateRequest: true,
    });
    expect(payload).not.toHaveProperty("projectKey");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration updated successfully",
    });
  });

  it("shows the formatted analytics enable/valid-till dates when present", () => {
    h.data = config({
      analyticsConfiguration: {
        enableAnalytics: true,
        enableDate: "2026-01-05T00:00:00.000Z",
        validTill: "2026-01-19T00:00:00.000Z",
      },
    });
    render(<DataGatewayContents />);

    expect(screen.queryAllByText("Not set").length).toBe(0);
    expect(screen.queryByText("Not set (analytics unavailable)")).toBeNull();
  });

  it("shows Not set for analytics dates that are absent", () => {
    h.data = config({ analyticsConfiguration: undefined });
    render(<DataGatewayContents />);

    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.getByText("Not set (analytics unavailable)")).toBeTruthy();
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({
      isSuccess: false,
      errors: { itemId: "A DataGateway configuration already exists. Use update instead." },
    });
    h.data = undefined;
    render(<DataGatewayContents />);

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { itemId: "A DataGateway configuration already exists. Use update instead." },
      }),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    h.data = undefined;
    render(<DataGatewayContents />);

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: "An unexpected error occurred. Please try again.",
      }),
    );
  });
});
