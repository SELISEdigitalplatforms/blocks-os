import { z } from "zod";
import type { IStorageConfiguration } from "@blocks-storage/models/storage.model";

/** Upper bound for a configured upload/download URL expiry (7 days), matching the backend's own limit. */
const MAX_EXPIRY_SECONDS = 604_800;

/** Upper bound for a configured maximum file size (50 MB), matching the backend's own limit. */
const MAX_FILE_SIZE_MB = 50;

/**
 * `isEditMode` controls whether the provider-identity/credential fields below are required.
 * They are hidden (not just disabled) in the edit-mode form - see save-storage-configuration.tsx -
 * because they can never actually change once a configuration exists (enforced server-side too), so
 * validating them (the backend never returns a secret, so they are empty) would only ever produce a
 * validation failure the user can't see or fix, since there's no rendered field left to show the
 * error on.
 */
export const buildStorageConfigurationFormSchema = (isEditMode: boolean) =>
  z
  .object({
    name: z.string().nonempty("Name is required").trim(),
    storageStrategy: z.enum(["AWS", "Azure", "SftpStorage", "S3Compatible"]),
    secretKey: z.string().trim().nullable(),
    accessKey: z.string().trim().nullable(),
    cloudStorageRegionEndPoint: z.string().trim().nullable(),
    connectionString: z.string().trim().nullable(),
    host: z.string().trim().nullable(),
    // abort: a failed number check skips the superRefine below, as zod 3 did (its transform
    // aborted); zod 4 runs it unless the failing check aborts. Number.isInteger, not .int(),
    // because zod 4's .int() also rejects unsafe integers; zod 3's did not.
    port: z
      .string()
      .trim()
      .pipe(
        // zod 3's default messages, kept so the form reads the same after the zod 4 upgrade.
        z.coerce
          .number<string>({ error: "Expected number, received nan" })
          .min(0, { error: "Number must be greater than or equal to 0", abort: true })
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
          .number<string>({ error: "Must be a number" })
          .refine(Number.isInteger, { error: "Must be a whole number of seconds", abort: true })
          .min(1, { error: "Must be at least 1 second", abort: true })
          .max(MAX_EXPIRY_SECONDS, {
            error: "Must be at most 604,800 seconds (7 days)",
            abort: true,
          })
          .transform((arg) => arg.toString()),
      ),
    downloadUrlExpirySeconds: z
      .string()
      .trim()
      .pipe(
        z.coerce
          .number<string>({ error: "Must be a number" })
          .refine(Number.isInteger, { error: "Must be a whole number of seconds", abort: true })
          .min(1, { error: "Must be at least 1 second", abort: true })
          .max(MAX_EXPIRY_SECONDS, {
            error: "Must be at most 604,800 seconds (7 days)",
            abort: true,
          })
          .transform((arg) => arg.toString()),
      ),
    maxFileSizeInMb: z
      .string()
      .trim()
      .pipe(
        z.coerce
          .number<string>({ error: "Must be a number" })
          .positive({ error: "Must be greater than 0", abort: true })
          .max(MAX_FILE_SIZE_MB, { error: `Must be at most ${MAX_FILE_SIZE_MB} MB`, abort: true })
          .transform((arg) => arg.toString()),
      ),
    uploadCompletionRequiredFor: z.array(z.enum(["Public", "Private"])),
  })
  .superRefine((data, ctx) => {
    if (isEditMode) return;

    const { storageStrategy } = data;

    const requireFields = (fields: (keyof typeof data)[], messages: Record<string, string>) => {
      fields.forEach((field) => {
        if (!data[field]) {
          ctx.addIssue({
            path: [field],
            code: "custom",
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

export type StorageConfigurationFormValues = z.infer<
  ReturnType<typeof buildStorageConfigurationFormSchema>
>;

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
 * same documented defaults the backend itself falls back to. Secret fields stay empty: the server
 * returns only a status per secret, and an update never sends one.
 */
export function toStorageConfigurationFormValues(
  configuration?: IStorageConfiguration,
): StorageConfigurationFormValues {
  if (!configuration) return storageConfigurationFormDefaultValue;

  return {
    ...storageConfigurationFormDefaultValue,
    name: configuration.name,
    storageStrategy: configuration.storageStrategy,
    cloudStorageRegionEndPoint: configuration.cloudStorageRegionEndPoint,
    host: configuration.host,
    port: configuration.port,
    userName: configuration.userName,
    remoteBasePath: configuration.remoteBasePath,
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
