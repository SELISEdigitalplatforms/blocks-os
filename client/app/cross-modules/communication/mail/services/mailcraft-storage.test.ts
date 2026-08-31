import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getFiles: vi.fn(),
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
  },
}));

import { createMailcraftStorageProvider } from "./mailcraft-storage";

describe("createMailcraftStorageProvider", () => {
  let storedValues: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    storedValues = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
      removeItem: (key: string) => storedValues.delete(key),
      clear: () => storedValues.clear(),
    });
    h.getFiles.mockResolvedValue([
      {
        itemId: "image-1",
        name: "welcome.png",
        url: "https://cdn.example/welcome.png",
        sizeInBytes: 10,
      },
      { itemId: "document-1", name: "guide.pdf", url: "https://cdn.example/guide.pdf" },
      {
        itemId: "image-2",
        name: "header.jpg",
        url: "https://cdn.example/header.jpg",
        sizeInBytes: 20,
      },
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

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("lists multiple image assets through GetFiles", async () => {
    localStorage.setItem(
      "blocks-os:mailcraft:file-ids:project-1",
      JSON.stringify(["image-1", "document-1", "image-2"]),
    );
    const provider = createMailcraftStorageProvider("project-1");

    const result = await provider.list({ cursor: null, query: null });

    expect(h.getFiles).toHaveBeenCalledWith({
      fileIds: ["image-1", "document-1", "image-2"],
      configurationName: "Default",
    });
    expect(result.items.map((item) => item.id)).toEqual(["image-1", "image-2"]);
    expect(result.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "document-1" })]),
    );
  });

  it("filters the image library by name", async () => {
    localStorage.setItem(
      "blocks-os:mailcraft:file-ids:project-1",
      JSON.stringify(["image-1", "image-2"]),
    );
    const provider = createMailcraftStorageProvider("project-1");

    const result = await provider.list({ cursor: null, query: "welcome" });

    expect(result.items.map((item) => item.id)).toEqual(["image-1"]);
  });

  it("uploads through the same presigned-url flow as Client logo", async () => {
    const provider = createMailcraftStorageProvider("project-1");
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    const asset = await provider.upload(file, { width: 120, height: 80 });

    expect(h.getPreSignedUrlForUpload).toHaveBeenCalledWith({
      itemId: "",
      accessModifier: "Public",
      configurationName: "Default",
      name: "welcome.png",
      projectKey: "project-1",
      tags: "",
      metaData: "",
      parentDirectoryId: "",
      moduleName: 5,
    });
    expect(h.uploadFile).toHaveBeenCalledWith({
      url: "https://upload.example/image-1",
      file,
    });
    expect(h.getFileByFileId).toHaveBeenCalledWith({
      itemId: "image-1",
      projectKey: "project-1",
    });
    expect(asset).toEqual({
      id: "image-1",
      name: "welcome.png",
      url: "https://cdn.example/image-1.png",
      folder: "",
      w: 120,
      ht: 80,
      size: file.size,
    });
    expect(localStorage.getItem("blocks-os:mailcraft:file-ids:project-1")).toBe(
      JSON.stringify(["image-1"]),
    );
  });

  it("sends all remembered upload IDs to GetFiles after a refresh", async () => {
    const firstProvider = createMailcraftStorageProvider("project-1");
    const firstFile = new File(["first"], "first.png", { type: "image/png" });
    await firstProvider.upload(firstFile, { width: 120, height: 80 });

    h.getPreSignedUrlForUpload.mockResolvedValueOnce({
      isSuccess: true,
      fileId: "image-2",
      uploadUrl: "https://upload.example/image-2",
    });
    h.getFileByFileId.mockResolvedValueOnce({
      itemId: "image-2",
      url: "https://cdn.example/image-2.png",
    });
    const secondFile = new File(["second"], "second.png", { type: "image/png" });
    await firstProvider.upload(secondFile, { width: 120, height: 80 });

    const refreshedProvider = createMailcraftStorageProvider("project-1");
    await refreshedProvider.list({ cursor: null, query: null });

    expect(h.getFiles).toHaveBeenLastCalledWith({
      fileIds: ["image-1", "image-2"],
      configurationName: "Default",
    });
  });

  it("uses a supplied directory without trying to create one", async () => {
    const provider = createMailcraftStorageProvider("project-1", {
      parentDirectoryId: "dir-42",
    });
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await provider.upload(file, { width: 120, height: 80 });

    expect(h.getPreSignedUrlForUpload).toHaveBeenCalledWith(
      expect.objectContaining({ parentDirectoryId: "dir-42" }),
    );
  });

  it("does not upload when the presigned-url request fails", async () => {
    h.getPreSignedUrlForUpload.mockResolvedValue({ isSuccess: false });
    const provider = createMailcraftStorageProvider("project-1");
    const file = new File(["image"], "welcome.png", { type: "image/png" });

    await expect(provider.upload(file, { width: 120, height: 80 })).rejects.toThrow(
      "Could not get an upload URL for the image.",
    );
    expect(h.uploadFile).not.toHaveBeenCalled();
  });

  it("removes an asset using the authenticated project key", async () => {
    localStorage.setItem(
      "blocks-os:mailcraft:file-ids:project-1",
      JSON.stringify(["image-1", "image-2"]),
    );
    const provider = createMailcraftStorageProvider("project-1");

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
      projectKey: "project-1",
    });
    expect(localStorage.getItem("blocks-os:mailcraft:file-ids:project-1")).toBe(
      JSON.stringify(["image-2"]),
    );
  });
});
