import { z } from "zod";
import type { IStorageConfiguration } from "@blocks-storage/models/storage.model";

/** Upper bound for a configured upload/download URL expiry (7 days), matching the backend's own limit. */
const MAX_EXPIRY_SECONDS = 604_800;

export const storageConfigurationFormSchema = z
  .object({
    name: z.string().nonempty("Name is required").trim(),
    storageStrategy: z.enum(["AWS", "Azure", "SftpStorage", "S3Compatible"]),
    secretKey: z.string().trim().nullable(),
    accessKey: z.string().trim().nullable(),
    cloudStorageRegionEndPoint: z.string().trim().nullable(),
    connectionString: z.string().trim().nullable(),
    host: z.string().trim().nullable(),
    port: z
      .string()
      .trim()
      .pipe(
        z.coerce
          .number()
          .min(0)
          .transform((arg) => arg.toString()),
      )
      .nullable(),
    userName: z.string().trim().nullable(),
    password: z.string().trim().nullable(),
    remoteBasePath: z.string().trim().nullable(),
    uploadUrlExpirySeconds: z
      .string()
      .trim()
      .pipe(
        z.coerce
          .number({ invalid_type_error: "Must be a number" })
          .int("Must be a whole number of seconds")
          .min(1, "Must be at least 1 second")
          .max(MAX_EXPIRY_SECONDS, "Must be at most 604,800 seconds (7 days)")
          .transform((arg) => arg.toString()),
      ),
    downloadUrlExpirySeconds: z
      .string()
      .trim()
      .pipe(
        z.coerce
          .number({ invalid_type_error: "Must be a number" })
          .int("Must be a whole number of seconds")
          .min(1, "Must be at least 1 second")
          .max(MAX_EXPIRY_SECONDS, "Must be at most 604,800 seconds (7 days)")
          .transform((arg) => arg.toString()),
      ),
    maxFileSizeInMb: z
      .string()
      .trim()
      .pipe(
        z.coerce
          .number({ invalid_type_error: "Must be a number" })
          .positive("Must be greater than 0")
          .transform((arg) => arg.toString()),
      ),
    uploadCompletionRequiredFor: z.array(z.enum(["Public", "Private"])),
  })
  .superRefine((data, ctx) => {
    const { storageStrategy } = data;

    const requireFields = (fields: (keyof typeof data)[], messages: Record<string, string>) => {
      fields.forEach((field) => {
        if (!data[field]) {
          ctx.addIssue({
            path: [field],
            code: z.ZodIssueCode.custom,
            message: messages[field] || `${field} is required`,
          });
        }
      });
    };

    if (storageStrategy === "AWS") {
      requireFields(["secretKey", "accessKey", "cloudStorageRegionEndPoint"], {
        secretKey: "Secret key is required",
        accessKey: "Access key is required",
        cloudStorageRegionEndPoint: "Region endpoint is required",
      });
    }

    if (storageStrategy === "Azure") {
      requireFields(["connectionString"], {
        connectionString: "Connection string is required",
      });
    }

    if (storageStrategy === "SftpStorage") {
      requireFields(["host", "port", "userName", "password", "remoteBasePath"], {
        host: "Host is required",
        port: "Port is required",
        userName: "Username is required",
        password: "Password is required",
        remoteBasePath: "Remote base path is required",
      });
    }

    if (storageStrategy === "S3Compatible") {
      requireFields(["accessKey", "secretKey", "host"], {
        accessKey: "Access key is required",
        secretKey: "Secret key is required",
        host: "Host URL is required",
      });
    }
  });

export type StorageConfigurationFormValues = z.infer<typeof storageConfigurationFormSchema>;

/** Matches the backend's own documented defaults (600s / 300s / 5 MiB / no required completion). */
export const storageConfigurationFormDefaultValue: StorageConfigurationFormValues = {
  name: "",
  storageStrategy: "AWS",
  secretKey: "",
  accessKey: "",
  cloudStorageRegionEndPoint: "",
  connectionString: "",
  remoteBasePath: "",
  host: null,
  port: "",
  userName: "",
  password: "",
  uploadUrlExpirySeconds: "600",
  downloadUrlExpirySeconds: "300",
  maxFileSizeInMb: "5",
  uploadCompletionRequiredFor: [],
};

/**
 * Maps a persisted configuration (bytes, seconds) onto the form's display representation (MB for
 * size). Missing Phase 1 fields - a configuration created before they existed - resolve to the
 * same documented defaults the backend itself falls back to.
 */
export function toStorageConfigurationFormValues(
  configuration?: IStorageConfiguration,
): StorageConfigurationFormValues {
  if (!configuration) return storageConfigurationFormDefaultValue;

  return {
    ...storageConfigurationFormDefaultValue,
    ...configuration,
    uploadUrlExpirySeconds: String(configuration.uploadUrlExpirySeconds ?? 600),
    downloadUrlExpirySeconds: String(configuration.downloadUrlExpirySeconds ?? 300),
    maxFileSizeInMb: String(
      configuration.maxFileSizeInBytes && configuration.maxFileSizeInBytes > 0
        ? configuration.maxFileSizeInBytes / (1024 * 1024)
        : 5,
    ),
    uploadCompletionRequiredFor: configuration.uploadCompletionRequiredFor ?? [],
  };
}
