import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getFiles: vi.fn(),
  getPreSignedUrlForUpload: vi.fn(),
  getFileByFileId: vi.fn(),
  uploadFile: vi.fn(),
  getFilesAndFolders: vi.fn(),
  createDmsFolder: vi.fn(),
}));

vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: {
    file: {
      getFiles: h.getFiles,
      getPreSignedUrlForUpload: h.getPreSignedUrlForUpload,
      getFileByFileId: h.getFileByFileId,
    },
    uploadFile: h.uploadFile,
    getFilesAndFolders: h.getFilesAndFolders,
    createDmsFolder: h.createDmsFolder,
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
      },
      { itemId: "document-1", name: "guide.pdf", url: "https://cdn.example/guide.pdf" },
    ]);
    h.getPreSignedUrlForUpload.mockResolvedValue({
      isSuccess: true,
      fileId: "image-1",
      uploadUrl: "https://upload.example/image-1",
    });
    h.getFileByFileId.mockResolvedValue({
      itemId: "image-1",
      url: "https://cdn.example/image-1.png",
    });
    h.getFilesAndFolders.mockResolvedValue({ dmsFileAndFolderInfos: [], totalCount: 0 });
    h.createDmsFolder.mockResolvedValue({ result: [{ fileStorageId: "dir-created", success: true }] });
  });

  it("lists image assets through the supported GetFiles endpoint", async () => {
    const provider = createMailcraftStorageProvider("project-1");

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

  it("creates the email-assets folder and uploads into it", async () => {
    const provider = createMailcraftStorageProvider("project-1");
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.createDmsFolder).toHaveBeenCalledWith(
      expect.objectContaining({ artifactName: "email-assets", parentId: "", projectKey: "project-1" }),
    );
    const payload = h.getPreSignedUrlForUpload.mock.calls[0][0];
    // `null` is never sent: it would ask the backend for the module's
    // default directory, which dev projects don't have.
    expect(payload).toMatchObject({ parentDirectoryId: "dir-created", projectKey: "project-1" });
  });

  it("reuses an existing folder without creating, and resolves it once", async () => {
    h.getFilesAndFolders.mockResolvedValue({
      dmsFileAndFolderInfos: [
        { type: 2, name: "email-assets", fileStorageId: "dir-existing", parentId: "", itemId: "x" },
      ],
      totalCount: 1,
    });
    const provider = createMailcraftStorageProvider("project-1");
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });
    await provider.upload(file, { width: 120, height: 80 });

    expect(h.createDmsFolder).not.toHaveBeenCalled();
    expect(h.getFilesAndFolders).toHaveBeenCalledTimes(1);
    expect(h.getPreSignedUrlForUpload.mock.calls[1][0]).toMatchObject({
      parentDirectoryId: "dir-existing",
    });
  });

  it("falls back to a root upload when the folder APIs fail", async () => {
    h.getFilesAndFolders.mockRejectedValue(new Error("dms unavailable"));
    const provider = createMailcraftStorageProvider("project-1");
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({ parentDirectoryId: "" });
  });

  it("uploads into a pinned directory without touching the folder APIs", async () => {
    const provider = createMailcraftStorageProvider("project-1", {
      parentDirectoryId: "dir-42",
    });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.getFilesAndFolders).not.toHaveBeenCalled();
    expect(h.createDmsFolder).not.toHaveBeenCalled();
    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({ parentDirectoryId: "dir-42" });
  });

  it("uploads to root when the folder is disabled", async () => {
    const provider = createMailcraftStorageProvider("project-1", { directoryName: null });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.getFilesAndFolders).not.toHaveBeenCalled();
    expect(h.getPreSignedUrlForUpload.mock.calls[0][0]).toMatchObject({ parentDirectoryId: "" });
  });
});
