import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/cross-modules/data-gateway/hooks/use-data-gateway-configuration", () => ({
  useSaveDataGatewayConfiguration: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isPending,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { SaveDataGatewayConfiguration } from "./save-data-gateway-configuration";

const renderModal = (
  props: Partial<React.ComponentProps<typeof SaveDataGatewayConfiguration>> = {},
) =>
  render(
    <Dialog open>
      <SaveDataGatewayConfiguration onClose={vi.fn()} {...props} />
    </Dialog>,
  );

const existingConfiguration = {
  itemId: "dg-5",
  createdBy: "user-1",
  createdDate: "2026-01-01T00:00:00.000Z",
  lastUpdatedBy: "user-1",
  lastUpdatedDate: "2026-01-10T00:00:00.000Z",
  projectKey: "project-key-5",
  projectShortKey: "proj5",
  connectionString: "********",
  databaseName: "existing_db",
  isCollectionNameEditable: true,
  collectionNamePattern: "custom_{SchemaName}",
  isDeleted: false,
  analyticsConfiguration: {
    enableAnalytics: true,
    enableDate: "2026-01-05T00:00:00.000Z",
    validTill: null,
  },
} as unknown as IDataGatewayConfiguration;

describe("SaveDataGatewayConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("shows the add heading, defaults the project key to the selected tenant, and saves a new configuration", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    expect(screen.getByText("Add DataGateway Configuration")).toBeTruthy();
    expect((screen.getByPlaceholderText("Enter project key") as HTMLInputElement).value).toBe(
      "tenant-1",
    );

    await user.type(screen.getByPlaceholderText("Enter database name"), "new_db");
    await user.type(
      screen.getByPlaceholderText("Enter connection string"),
      "mongodb://localhost:27017",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      projectKey: "tenant-1",
      databaseName: "new_db",
      connectionString: "mongodb://localhost:27017",
      isCollectionNameEditable: false,
      collectionNamePattern: "sb_{SchemaName}s",
      enableAnalytics: false,
      updateRequest: false,
    });
    expect(payload).not.toHaveProperty("itemId");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "New configuration added successfully",
    });
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("shows validation errors when required fields are blank", async () => {
    const user = userEvent.setup();
    renderModal();

    // Project Key defaults to the selected tenant, so clear it to exercise its own validation
    // alongside the still-blank database name and connection string.
    await user.clear(screen.getByPlaceholderText("Enter project key"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Project key is required")).toBeTruthy();
    expect(screen.getByText("Database name is required")).toBeTruthy();
    expect(screen.getByText("Connection string is required")).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("renders the edit heading, disables the project key, and leaves the connection string blank", async () => {
    renderModal({ configuration: existingConfiguration });

    expect(screen.getByText("Edit DataGateway Configuration")).toBeTruthy();

    const projectKeyInput = screen.getByPlaceholderText("Enter project key") as HTMLInputElement;
    expect(projectKeyInput.value).toBe("project-key-5");
    expect(projectKeyInput.disabled).toBe(true);

    // The read endpoint always masks the connection string - the update form must never pre-fill
    // it, or an unrelated save could silently overwrite the real secret with the mask itself.
    expect(
      (screen.getByPlaceholderText(
        "Enter a new connection string to rotate it",
      ) as HTMLInputElement).value,
    ).toBe("");
    expect((screen.getByPlaceholderText("Enter database name") as HTMLInputElement).value).toBe(
      "existing_db",
    );
  });

  it("requires a connection string before an update can be saved", async () => {
    const user = userEvent.setup();
    renderModal({ configuration: existingConfiguration });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Connection string is required")).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("submits an update payload identified by itemId, without a project key", async () => {
    const user = userEvent.setup();
    renderModal({ configuration: existingConfiguration });

    await user.type(
      screen.getByPlaceholderText("Enter a new connection string to rotate it"),
      "mongodb://new-connection",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      itemId: "dg-5",
      connectionString: "mongodb://new-connection",
      databaseName: "existing_db",
      isCollectionNameEditable: true,
      collectionNamePattern: "custom_{SchemaName}",
      enableAnalytics: true,
      updateRequest: true,
    });
    expect(payload).not.toHaveProperty("projectKey");
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration updated successfully",
    });
  });

  it("toggles editable collection names and analytics", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("Enter database name"), "new_db");
    await user.type(
      screen.getByPlaceholderText("Enter connection string"),
      "mongodb://localhost:27017",
    );
    await user.click(screen.getByRole("switch", { name: "Editable Collection Names" }));
    await user.click(screen.getByRole("switch", { name: "Enable Analytics" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.isCollectionNameEditable).toBe(true);
    expect(payload.enableAnalytics).toBe(true);
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({
      isSuccess: false,
      errors: { projectKey: "A DataGateway configuration for this ProjectKey already exists." },
    });
    renderModal();

    await user.type(screen.getByPlaceholderText("Enter database name"), "new_db");
    await user.type(
      screen.getByPlaceholderText("Enter connection string"),
      "mongodb://localhost:27017",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { projectKey: "A DataGateway configuration for this ProjectKey already exists." },
      }),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderModal();

    await user.type(screen.getByPlaceholderText("Enter database name"), "new_db");
    await user.type(
      screen.getByPlaceholderText("Enter connection string"),
      "mongodb://localhost:27017",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });
});
