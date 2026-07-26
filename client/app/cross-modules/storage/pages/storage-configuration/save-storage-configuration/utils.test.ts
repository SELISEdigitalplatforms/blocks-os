import { describe, expect, it } from "vitest";
import {
  storageConfigurationFormSchema,
  storageConfigurationFormDefaultValue,
} from "./utils";

const base = {
  ...storageConfigurationFormDefaultValue,
  name: "my-config",
  port: "22",
  host: "host",
};

describe("storageConfigurationFormSchema", () => {
  it("requires a name", () => {
    const result = storageConfigurationFormSchema.safeParse({ ...base, name: "" });
    expect(result.success).toBe(false);
  });

  it("requires AWS credentials for the AWS strategy", () => {
    const result = storageConfigurationFormSchema.safeParse({
      ...base,
      storageStrategy: "AWS",
      secretKey: "",
      accessKey: "",
      cloudStorageRegionEndPoint: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Secret key is required");
      expect(messages).toContain("Access key is required");
      expect(messages).toContain("Region endpoint is required");
    }
  });

  it("accepts a complete AWS configuration", () => {
    const result = storageConfigurationFormSchema.safeParse({
      ...base,
      storageStrategy: "AWS",
      secretKey: "sk",
      accessKey: "ak",
      cloudStorageRegionEndPoint: "eu-central-1",
    });
    expect(result.success).toBe(true);
  });

  it("requires a connection string for the Azure strategy", () => {
    const result = storageConfigurationFormSchema.safeParse({
      ...base,
      storageStrategy: "Azure",
      connectionString: "",
    });
    expect(result.success).toBe(false);
  });

  it("requires SFTP fields for the SftpStorage strategy", () => {
    const result = storageConfigurationFormSchema.safeParse({
      ...base,
      storageStrategy: "SftpStorage",
      host: "",
      userName: "",
      password: "",
      remoteBasePath: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Host is required");
      expect(messages).toContain("Username is required");
    }
  });

  it("requires access/secret/host for the S3Compatible strategy", () => {
    const result = storageConfigurationFormSchema.safeParse({
      ...base,
      storageStrategy: "S3Compatible",
      accessKey: "",
      secretKey: "",
      host: "",
    });
    expect(result.success).toBe(false);
  });

  it("coerces a numeric port string", () => {
    const result = storageConfigurationFormSchema.safeParse({
      ...base,
      storageStrategy: "AWS",
      secretKey: "sk",
      accessKey: "ak",
      cloudStorageRegionEndPoint: "eu",
      port: "8080",
    });
    expect(result.success).toBe(true);
  });
});
