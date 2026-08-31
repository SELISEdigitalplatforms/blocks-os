import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getFiles: vi.fn(),
  createDirectory: vi.fn(),
  getPreSignedUrlForUpload: vi.fn(),
  getFileByFileId: vi.fn(),
  deleteFileByFileId: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: {
    file: {
      getFiles: h.getFiles,

      getPreSignedUrlForUpload: h.getPreSignedUrlForUpload,
      getFileByFileId: h.getFileByFileId,
      deleteFileByFileId: h.deleteFileByFileId,
    },
    uploadFile: h.uploadFile,
    createDirectory: h.createDirectory,
  },
}));

import { createMailcraftStorageProvider } from "./mailcraft-storage";

describe("createMailcraftStorageProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getFiles.mockResolvedValue([
      {
        itemId: "image-1",
        name: "welcome.png",
        url: "https://cdn.example/welcome.png",
        sizeInBytes: 10,
        parentDirectoryID: "dir-org-42",
        tags: ["mailcraft"],
      },
      { itemId: "document-1", name: "guide.pdf", url: "https://cdn.example/guide.pdf" },
      {
        itemId: "image-2",
        name: "someone-elses.png",
        url: "https://cdn.example/someone-elses.png",
        tags: ["profile-image"],
      },
    ]);
    h.createDirectory.mockResolvedValue({ status: "Succeeded", directoryId: "dir-created" });
    h.getPreSignedUrlForUpload.mockResolvedValue({
      isSuccess: true,
      fileId: "image-1",
      uploadUrl: "https://upload.example/image-1",
    });
    h.getFileByFileId.mockResolvedValue({
      itemId: "image-1",
      url: "https://cdn.example/image-1.png",
    });
  });

  it("lists image assets through the supported GetFiles endpoint", async () => {
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });

    const result = await provider.list({ cursor: null, query: "welcome" });

    expect(h.getFiles).toHaveBeenCalledWith({ fileIds: [], configurationName: "Default" });
    expect(result).toEqual({
      items: [
        {
          id: "image-1",
          name: "welcome.png",
          url: "https://cdn.example/welcome.png",
          folder: "",
          w: 0,
          ht: 0,
          size: 10,
        },
      ],
      cursor: null,
    });
  });

  // Blocks Logic has no folder API -- CreateFolder/GetDmsFileAndFolder are not
  // routed and fall through to the SPA's index.html -- so uploads go to the
  // storage root, exactly like the profile-image and branding uploaders.
  it("uploads to the storage root without touching any folder API", async () => {
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    const asset = await provider.upload(file, { width: 120, height: 80 });

    // Never "" or null: both ask the backend for the module's default
    // directory, which this project does not have.
    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({
      parentDirectoryId: "dir-org-42",
      tags: JSON.stringify(["mailcraft"]),
      additionalProperties: { source: "mailcraft" },
      moduleName: 5,
      configurationName: "Default",
      accessModifier: "Public",
      name: "welcome.png",
    });
    expect(h.uploadFile).toHaveBeenCalledWith({
      url: "https://upload.example/image-1",
      file,
    });
    expect(asset).toMatchObject({
      id: "image-1",
      name: "welcome.png",
      url: "https://cdn.example/image-1.png",
      w: 120,
      ht: 80,
    });
  });

  it("lists only files this editor uploaded", async () => {
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });

    const result = await provider.list({ cursor: null, query: null });

    // The project's other images (profile pictures, branding logos) are in the
    // same flat storage and must not surface in the editor's library.
    expect(result.items.map((item) => item.id)).toEqual(["image-1"]);
  });

  it("fails with a diagnosable error when no directory can be discovered", async () => {
    h.getFiles.mockResolvedValue([]);
    h.createDirectory.mockResolvedValue({ status: "NotPermitted" });
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await expect(provider.upload(file, { width: 120, height: 80 })).rejects.toThrow(
      /Could not create the "org-42" storage directory/,
    );
    expect(h.getPreSignedUrlForUpload).not.toHaveBeenCalled();
  });

  it("resolves the directory once and reuses it", async () => {
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });
    await provider.upload(file, { width: 120, height: 80 });

    expect(h.getFiles).toHaveBeenCalledTimes(1);
    expect(h.getPreSignedUrlForUpload.mock.calls[1][0]).toMatchObject({
      parentDirectoryId: "dir-org-42",
    });
  });

  it("creates the org directory at the root when none is known yet", async () => {
    h.getFiles.mockResolvedValue([]);
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.createDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "org-42", parentDirectoryId: "" }),
    );
    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({
      parentDirectoryId: "dir-created",
    });
  });

  it("reuses the directory its own uploads already live in", async () => {
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.createDirectory).not.toHaveBeenCalled();
    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({
      parentDirectoryId: "dir-org-42",
    });
  });

  it("uploads into a pinned directory when the host supplies one", async () => {
    const provider = createMailcraftStorageProvider({
      organizationId: "org-42",
      parentDirectoryId: "dir-42",
    });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({
      parentDirectoryId: "dir-42",
    });
  });

  it("surfaces a failed presigned-url request instead of uploading", async () => {
    h.getPreSignedUrlForUpload.mockResolvedValue({ isSuccess: false, errors: { name: "taken" } });
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await expect(provider.upload(file, { width: 120, height: 80 })).rejects.toThrow(
      "Could not get an upload URL for the image.",
    );
    expect(h.uploadFile).not.toHaveBeenCalled();
  });

  it("removes an asset by its backend file id", async () => {
    const provider = createMailcraftStorageProvider({ organizationId: "org-42" });

    await provider.remove({
      id: "image-1",
      name: "welcome.png",
      url: "",
      folder: "",
      w: 0,
      ht: 0,
      size: 0,
    });

    expect(h.deleteFileByFileId).toHaveBeenCalledWith({
      fileId: "image-1",
    });
  });
});
