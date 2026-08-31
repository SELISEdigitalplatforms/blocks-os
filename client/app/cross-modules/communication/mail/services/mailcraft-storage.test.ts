import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getFiles: vi.fn(),
  getPreSignedUrlForUpload: vi.fn(),
  getFileByFileId: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: {
    file: {
      getFiles: h.getFiles,
      getPreSignedUrlForUpload: h.getPreSignedUrlForUpload,
      getFileByFileId: h.getFileByFileId,
    },
    uploadFile: h.uploadFile,
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

  it("uses the authenticated project context when requesting an upload URL", async () => {
    const provider = createMailcraftStorageProvider("project-1");
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    const payload = h.getPreSignedUrlForUpload.mock.calls[0][0];
    // Root upload, no directory lookup: `null` would ask the backend for the
    // module's default directory, which dev projects don't have.
    expect(payload).toMatchObject({ parentDirectoryId: "", projectKey: "project-1" });
  });

  it("uploads into a pinned directory when one is configured", async () => {
    const provider = createMailcraftStorageProvider("project-1", {
      parentDirectoryId: "dir-42",
    });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    const payload = h.getPreSignedUrlForUpload.mock.calls[0][0];
    expect(payload).toMatchObject({ parentDirectoryId: "dir-42" });
  });
});
