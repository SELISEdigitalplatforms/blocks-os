import { describe, expect, it } from "vitest";
import { STORAGE_STRATEGIES, DmsItemType } from "./storage.model";

describe("STORAGE_STRATEGIES", () => {
  it("lists every supported storage strategy", () => {
    expect(STORAGE_STRATEGIES.map((s) => s.value)).toEqual([
      "AWS",
      "Azure",
      "SftpStorage",
      "S3Compatible",
    ]);
  });

  it("gives the SFTP strategy a friendly label", () => {
    const sftp = STORAGE_STRATEGIES.find((s) => s.value === "SftpStorage");
    expect(sftp?.label).toBe("SFTP");
  });
});

describe("DmsItemType", () => {
  it("numbers files and folders to match the backend", () => {
    expect(DmsItemType.File).toBe(1);
    expect(DmsItemType.Folder).toBe(2);
    expect(DmsItemType[1]).toBe("File");
  });
});
