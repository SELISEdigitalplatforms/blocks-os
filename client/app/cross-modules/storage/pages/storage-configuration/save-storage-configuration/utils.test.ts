import { describe, expect, it } from "vitest";
import type { IStorageConfiguration } from "@blocks-storage/models/storage.model";
import {
  buildStorageConfigurationFormSchema,
  storageConfigurationFormDefaultValue,
  toStorageConfigurationFormValues,
} from "./utils";

const base = {
  ...storageConfigurationFormDefaultValue,
  name: "my-config",
  port: "22",
  host: "host",
};

// Add-mode schema: provider-identity/credential fields are required, matching every existing test
// below. Edit mode (see the dedicated describe block) skips that validation entirely.
const storageConfigurationFormSchema = buildStorageConfigurationFormSchema(false);

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

  describe("Phase 1 upload-security fields", () => {
    const validBase = { ...base, storageStrategy: "Azure" as const, connectionString: "conn" };

    it.each(["0", "-1", "604801", "not-a-number"])(
      "rejects an out-of-range uploadUrlExpirySeconds of %s",
      (value) => {
        const result = storageConfigurationFormSchema.safeParse({
          ...validBase,
          uploadUrlExpirySeconds: value,
        });
        expect(result.success).toBe(false);
      },
    );

    it.each(["1", "600", "604800"])(
      "accepts an in-range uploadUrlExpirySeconds of %s",
      (value) => {
        const result = storageConfigurationFormSchema.safeParse({
          ...validBase,
          uploadUrlExpirySeconds: value,
        });
        expect(result.success).toBe(true);
      },
    );

    it.each(["0", "-1"])("rejects a non-positive maxFileSizeInMb of %s", (value) => {
      const result = storageConfigurationFormSchema.safeParse({
        ...validBase,
        maxFileSizeInMb: value,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a maxFileSizeInMb over the 50 MB limit", () => {
      const result = storageConfigurationFormSchema.safeParse({
        ...validBase,
        maxFileSizeInMb: "51",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((i) => i.message)).toContain("Must be at most 50 MB");
      }
    });

    it("accepts a maxFileSizeInMb of exactly 50 MB", () => {
      const result = storageConfigurationFormSchema.safeParse({
        ...validBase,
        maxFileSizeInMb: "50",
      });
      expect(result.success).toBe(true);
    });

    it("accepts an empty uploadCompletionRequiredFor and both allowed values", () => {
      expect(
        storageConfigurationFormSchema.safeParse({ ...validBase, uploadCompletionRequiredFor: [] })
          .success,
      ).toBe(true);
      expect(
        storageConfigurationFormSchema.safeParse({
          ...validBase,
          uploadCompletionRequiredFor: ["Public", "Private"],
        }).success,
      ).toBe(true);
    });

    it("rejects an access modifier other than Public/Private", () => {
      const result = storageConfigurationFormSchema.safeParse({
        ...validBase,
        uploadCompletionRequiredFor: ["Secure"],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("buildStorageConfigurationFormSchema(true) - edit mode", () => {
  // The provider identity/credential fields are hidden (not rendered) in the edit-mode form, so
  // validating them would fail silently with no way for the user to see or fix the error. A real
  // GET response can also return these masked or null for a provider that doesn't use them, which
  // must never block saving a Phase 1 field change.
  const editSchema = buildStorageConfigurationFormSchema(true);

  it("accepts missing AWS credentials", () => {
    const result = editSchema.safeParse({
      ...base,
      storageStrategy: "AWS",
      secretKey: null,
      accessKey: null,
      cloudStorageRegionEndPoint: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a missing Azure connection string", () => {
    const result = editSchema.safeParse({
      ...base,
      storageStrategy: "Azure",
      connectionString: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing SFTP fields", () => {
    const result = editSchema.safeParse({
      ...base,
      storageStrategy: "SftpStorage",
      host: null,
      userName: null,
      password: null,
      remoteBasePath: null,
    });
    expect(result.success).toBe(true);
  });

  it("still requires a name and still validates the Phase 1 fields", () => {
    expect(editSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(
      editSchema.safeParse({ ...base, uploadUrlExpirySeconds: "0" }).success,
    ).toBe(false);
  });
});

describe("toStorageConfigurationFormValues", () => {
  const baseConfiguration: IStorageConfiguration = {
    storageStrategy: "Azure",
    accessKey: null,
    cloudStorageRegionEndPoint: null,
    connectionString: "conn",
    createdBy: "me",
    createdDate: "2024-01-01",
    itemId: "cfg-1",
    lastUpdatedBy: "me",
    lastUpdatedDate: "2024-01-02",
    name: "azure-store",
    organizationIds: [],
    secretKey: null,
    tags: [],
    host: null,
    port: null,
    userName: null,
    password: null,
    remoteBasePath: null,
  };

  it("falls back to the documented defaults for a new configuration", () => {
    expect(toStorageConfigurationFormValues(undefined)).toEqual(
      storageConfigurationFormDefaultValue,
    );
  });

  it("falls back to the documented defaults for a configuration that predates Phase 1", () => {
    const values = toStorageConfigurationFormValues(baseConfiguration);

    expect(values.uploadUrlExpirySeconds).toBe("600");
    expect(values.downloadUrlExpirySeconds).toBe("300");
    expect(values.maxFileSizeInMb).toBe("5");
    expect(values.uploadCompletionRequiredFor).toEqual([]);
  });

  it("converts a configured maxFileSizeInBytes to MB for display", () => {
    const values = toStorageConfigurationFormValues({
      ...baseConfiguration,
      uploadUrlExpirySeconds: 900,
      downloadUrlExpirySeconds: 120,
      maxFileSizeInBytes: 10_485_760,
      uploadCompletionRequiredFor: ["Public"],
    });

    expect(values.uploadUrlExpirySeconds).toBe("900");
    expect(values.downloadUrlExpirySeconds).toBe("120");
    expect(values.maxFileSizeInMb).toBe("10");
    expect(values.uploadCompletionRequiredFor).toEqual(["Public"]);
  });
});
