import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IStorageConfiguration } from "@blocks-storage/models/storage.model";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-storage/hooks/use-storage-configuration", () => ({
  useSaveStorageConfiguration: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { SaveStorageConfiguration } from "./save-storage-configuration";

const renderModal = (props: Partial<React.ComponentProps<typeof SaveStorageConfiguration>> = {}) =>
  render(
    <Dialog open>
      <SaveStorageConfiguration onClose={vi.fn()} {...props} />
    </Dialog>,
  );

const fillAws = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Enter name"), "Primary Bucket");
  await user.type(screen.getByPlaceholderText("Enter access key"), "AKIA123");
  await user.type(screen.getByPlaceholderText("Enter secret key"), "secret123");
  await user.type(screen.getByPlaceholderText("Enter region endpoint"), "eu-central-1");
};

describe("SaveStorageConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("shows the AWS fields by default and saves a new configuration", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    expect(screen.getByText("Add Storage Configuration")).toBeTruthy();
    await fillAws(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Primary Bucket",
      storageStrategy: "AWS",
      accessKey: "AKIA123",
      projectKey: "tenant-1",
      updateRequest: false,
      itemId: null,
    });
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "New configuration added successfully",
    });
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("shows validation errors when required fields are blank", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(screen.getByText("Access key is required")).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("swaps to the Azure-specific field when the provider changes", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Azure" }));

    expect(await screen.findByPlaceholderText("Enter connection string")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Enter access key")).toBeNull();

    await user.type(screen.getByPlaceholderText("Enter name"), "Azure Store");
    await user.type(
      screen.getByPlaceholderText("Enter connection string"),
      "DefaultEndpointsProtocol=https;",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync.mock.calls[0][0].storageStrategy).toBe("Azure");
  });

  it("renders the edit heading, hides the provider identity fields, and marks the save as an update", async () => {
    const user = userEvent.setup();
    const configuration = {
      itemId: "cfg-5",
      name: "Existing Store",
      storageStrategy: "AWS",
      accessKey: "AKIAOLD",
      secretKey: "secretold",
      cloudStorageRegionEndPoint: "us-east-1",
      connectionString: null,
      host: null,
      port: null,
      userName: null,
      password: null,
      remoteBasePath: null,
    } as unknown as IStorageConfiguration;
    renderModal({ configuration });

    expect(screen.getByText("Edit Storage Configuration")).toBeTruthy();
    expect(
      screen.getByText("Only the upload and verification settings below can be changed."),
    ).toBeTruthy();

    // Only the Phase 1 upload/verification fields may change once a configuration exists - the
    // provider identity and its credentials aren't rendered at all in edit mode.
    expect(screen.queryByText("Storage Provider")).toBeNull();
    expect(screen.queryByPlaceholderText("Enter name")).toBeNull();
    expect(screen.queryByPlaceholderText("Enter access key")).toBeNull();
    expect(screen.queryByPlaceholderText("Enter secret key")).toBeNull();
    expect(screen.queryByPlaceholderText("Enter region endpoint")).toBeNull();

    await user.clear(screen.getByLabelText("Maximum File Size (MB)"));
    await user.type(screen.getByLabelText("Maximum File Size (MB)"), "10");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    // An update carries nothing but the settings it is allowed to change plus what identifies the
    // configuration being changed. The name, the provider and its credentials must not reach the
    // wire at all - the server discards them, and the only value the client holds for a secret is
    // the masked one the read endpoint gave it.
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      "downloadUrlExpirySeconds",
      "itemId",
      "maxFileSizeInBytes",
      "projectKey",
      "updateRequest",
      "uploadCompletionRequiredFor",
      "uploadUrlExpirySeconds",
    ]);
    expect(payload.updateRequest).toBe(true);
    expect(payload.itemId).toBe("cfg-5");
    expect(payload.maxFileSizeInBytes).toBe(10_485_760);
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration updated successfully",
    });
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { name: "duplicate" } });
    renderModal();

    await fillAws(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "duplicate" } }),
    );
  });

  it("shows a generic error when the save throws", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderModal();

    await fillAws(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  describe("Phase 1 upload-security fields", () => {
    it("defaults a new configuration to 600s upload, 300s download, 5 MB, and no required completion", () => {
      renderModal();

      expect(
        (screen.getByLabelText("Upload URL Expiry (seconds)") as HTMLInputElement).value,
      ).toBe("600");
      expect(
        (screen.getByLabelText("Download URL Expiry (seconds)") as HTMLInputElement).value,
      ).toBe("300");
      expect((screen.getByLabelText("Maximum File Size (MB)") as HTMLInputElement).value).toBe(
        "5",
      );
      expect(screen.getByRole("switch", { name: "Public" }).getAttribute("aria-checked")).toBe(
        "false",
      );
      expect(screen.getByRole("switch", { name: "Private" }).getAttribute("aria-checked")).toBe(
        "false",
      );
    });

    it("converts a configured maxFileSizeInBytes to MB and prefills expiry/completion in edit mode", () => {
      const configuration = {
        itemId: "cfg-5",
        name: "Existing Store",
        storageStrategy: "AWS",
        accessKey: "AKIAOLD",
        secretKey: "secretold",
        cloudStorageRegionEndPoint: "us-east-1",
        connectionString: null,
        host: null,
        port: null,
        userName: null,
        password: null,
        remoteBasePath: null,
        uploadUrlExpirySeconds: 900,
        downloadUrlExpirySeconds: 120,
        maxFileSizeInBytes: 10_485_760,
        uploadCompletionRequiredFor: ["Public"],
      } as unknown as IStorageConfiguration;
      renderModal({ configuration });

      expect(
        (screen.getByLabelText("Upload URL Expiry (seconds)") as HTMLInputElement).value,
      ).toBe("900");
      expect(
        (screen.getByLabelText("Download URL Expiry (seconds)") as HTMLInputElement).value,
      ).toBe("120");
      expect((screen.getByLabelText("Maximum File Size (MB)") as HTMLInputElement).value).toBe(
        "10",
      );
      expect(screen.getByRole("switch", { name: "Public" }).getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(screen.getByRole("switch", { name: "Private" }).getAttribute("aria-checked")).toBe(
        "false",
      );
    });

    it("submits the converted byte size and selected access modifiers", async () => {
      const user = userEvent.setup();
      renderModal();

      await fillAws(user);
      await user.clear(screen.getByLabelText("Maximum File Size (MB)"));
      await user.type(screen.getByLabelText("Maximum File Size (MB)"), "10");
      await user.click(screen.getByRole("switch", { name: "Private" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload).toMatchObject({
        uploadUrlExpirySeconds: 600,
        downloadUrlExpirySeconds: 300,
        maxFileSizeInBytes: 10_485_760,
        uploadCompletionRequiredFor: ["Private"],
      });
      expect(payload).not.toHaveProperty("maxFileSizeInMb");
    });

    it("rejects an expiry outside the 1-604800 second range", async () => {
      const user = userEvent.setup();
      renderModal();

      await user.clear(screen.getByLabelText("Upload URL Expiry (seconds)"));
      await user.type(screen.getByLabelText("Upload URL Expiry (seconds)"), "0");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Must be at least 1 second")).toBeTruthy();
      expect(h.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("a single mounted instance switching from Add to Edit (regression)", () => {
    // In the real app, SaveStorageConfiguration is always present as a child of the storage
    // page's <Dialog> - only Radix's internal open state toggles, so this component never
    // actually unmounts between an "Add" render and a later "Edit" open of the same instance.
    // `renderModal()` above always mounts fresh, which is exactly why the original
    // useForm({ defaultValues }) bug (form staying stuck on Add-mode empty defaults forever)
    // never showed up in any of the tests above.
    it("picks up the real configuration after being opened once with none, without remounting", async () => {
      const user = userEvent.setup();
      const configuration = {
        itemId: "cfg-9",
        name: "Existing Store",
        storageStrategy: "Azure",
        accessKey: null,
        secretKey: null,
        cloudStorageRegionEndPoint: null,
        connectionString: "conn-string",
        host: null,
        port: null,
        userName: null,
        password: null,
        remoteBasePath: null,
        // Deliberately different from the Add-mode defaults (600 / 300 / 5 MB / none) this instance
        // was first mounted with, so the assertions below can tell a synced form from a stale one.
        uploadUrlExpirySeconds: 900,
        downloadUrlExpirySeconds: 120,
        maxFileSizeInBytes: 10_485_760,
        uploadCompletionRequiredFor: ["Private"],
      } as unknown as IStorageConfiguration;

      const utils = render(
        <Dialog open>
          <SaveStorageConfiguration onClose={vi.fn()} />
        </Dialog>,
      );
      expect(screen.getByText("Add Storage Configuration")).toBeTruthy();

      utils.rerender(
        <Dialog open>
          <SaveStorageConfiguration onClose={vi.fn()} configuration={configuration} />
        </Dialog>,
      );

      expect(await screen.findByText("Edit Storage Configuration")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
      const payload = h.mutateAsync.mock.calls[0][0];
      expect(payload.updateRequest).toBe(true);
      expect(payload.itemId).toBe("cfg-9");
      // The form must be carrying this configuration's own settings. A form still stuck on the
      // Add-mode defaults it first mounted with would send 600 / 300 / 5 MB / [] instead.
      expect(payload.uploadUrlExpirySeconds).toBe(900);
      expect(payload.downloadUrlExpirySeconds).toBe(120);
      expect(payload.maxFileSizeInBytes).toBe(10_485_760);
      expect(payload.uploadCompletionRequiredFor).toEqual(["Private"]);
    });
  });
});
