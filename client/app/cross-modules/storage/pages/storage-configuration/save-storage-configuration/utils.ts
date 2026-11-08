import { z } from "zod";
import type { IStorageConfiguration } from "@blocks-storage/models/storage.model";
import { tStatic } from "@seliseblocks/genesis-os";

const KEY_MUST_BE_A_NUMBER = "UTILS.MUST_BE_A_NUMBER";

const I18N_MODULE = "os.storage";

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
      name: z.string().nonempty(tStatic(I18N_MODULE, "UTILS.NAME_IS_REQUIRED")).trim(),
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
            .number<string>({ error: tStatic(I18N_MODULE, "UTILS.EXPECTED_NUMBER_RECEIVED_NAN") })
            .min(0, {
              error: tStatic(I18N_MODULE, "UTILS.NUMBER_MUST_BE_GREATER_THAN"),
              abort: true,
            })
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
            .number<string>({ error: tStatic(I18N_MODULE, KEY_MUST_BE_A_NUMBER) })
            .refine(Number.isInteger, {
              error: tStatic(I18N_MODULE, "UTILS.MUST_BE_A_WHOLE_NUMBER"),
              abort: true,
            })
            .min(1, { error: tStatic(I18N_MODULE, "UTILS.MUST_BE_AT_LEAST_1"), abort: true })
            .max(MAX_EXPIRY_SECONDS, {
              error: tStatic(I18N_MODULE, "UTILS.MUST_BE_AT_MOST_604"),
              abort: true,
            })
            .transform((arg) => arg.toString()),
        ),
      downloadUrlExpirySeconds: z
        .string()
        .trim()
        .pipe(
          z.coerce
            .number<string>({ error: tStatic(I18N_MODULE, KEY_MUST_BE_A_NUMBER) })
            .refine(Number.isInteger, {
              error: tStatic(I18N_MODULE, "UTILS.MUST_BE_A_WHOLE_NUMBER"),
              abort: true,
            })
            .min(1, { error: tStatic(I18N_MODULE, "UTILS.MUST_BE_AT_LEAST_1"), abort: true })
            .max(MAX_EXPIRY_SECONDS, {
              error: tStatic(I18N_MODULE, "UTILS.MUST_BE_AT_MOST_604"),
              abort: true,
            })
            .transform((arg) => arg.toString()),
        ),
      maxFileSizeInMb: z
        .string()
        .trim()
        .pipe(
          z.coerce
            .number<string>({ error: tStatic(I18N_MODULE, KEY_MUST_BE_A_NUMBER) })
            .positive({ error: tStatic(I18N_MODULE, "UTILS.MUST_BE_GREATER_THAN_0"), abort: true })
            .max(MAX_FILE_SIZE_MB, {
              error: tStatic(I18N_MODULE, "UTILS.MUST_BE_AT_MOST_MB", { MAX_FILE_SIZE_MB }),
              abort: true,
            })
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
              message: messages[field] || tStatic(I18N_MODULE, "UTILS.IS_REQUIRED", { field }),
            });
          }
        });
      };

      if (storageStrategy === "AWS") {
        requireFields(["secretKey", "accessKey", "cloudStorageRegionEndPoint"], {
          secretKey: tStatic(I18N_MODULE, "UTILS.SECRET_KEY_IS_REQUIRED"),
          accessKey: tStatic(I18N_MODULE, "UTILS.ACCESS_KEY_IS_REQUIRED"),
          cloudStorageRegionEndPoint: tStatic(I18N_MODULE, "UTILS.REGION_ENDPOINT_IS_REQUIRED"),
        });
      }

      if (storageStrategy === "Azure") {
        requireFields(["connectionString"], {
          connectionString: tStatic(I18N_MODULE, "UTILS.CONNECTION_STRING_IS_REQUIRED"),
        });
      }

      if (storageStrategy === "SftpStorage") {
        requireFields(["host", "port", "userName", "password", "remoteBasePath"], {
          host: tStatic(I18N_MODULE, "UTILS.HOST_IS_REQUIRED"),
          port: tStatic(I18N_MODULE, "UTILS.PORT_IS_REQUIRED"),
          userName: tStatic(I18N_MODULE, "UTILS.USERNAME_IS_REQUIRED"),
          password: tStatic(I18N_MODULE, "UTILS.PASSWORD_IS_REQUIRED"),
          remoteBasePath: tStatic(I18N_MODULE, "UTILS.REMOTE_BASE_PATH_IS_REQUIRED"),
        });
      }

      if (storageStrategy === "S3Compatible") {
        requireFields(["accessKey", "secretKey", "host"], {
          accessKey: tStatic(I18N_MODULE, "UTILS.ACCESS_KEY_IS_REQUIRED"),
          secretKey: tStatic(I18N_MODULE, "UTILS.SECRET_KEY_IS_REQUIRED"),
          host: tStatic(I18N_MODULE, "UTILS.HOST_URL_IS_REQUIRED"),
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
