import { z } from "zod";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import { DEFAULT_COLLECTION_NAME_PATTERN } from "@/cross-modules/data-gateway/models/data-gateway.model";

/**
 * `isEditMode` controls whether `projectKey` is required. It identifies which project a brand new
 * configuration belongs to, so it's only meaningful on create - an update is identified by
 * `itemId` instead, and the project a configuration belongs to is fixed once it exists.
 *
 * `connectionString` is required in both modes, unlike Storage's masked secrets: this field is
 * the very thing an update exists to change, and the backend itself requires it non-empty on
 * every save, create or update alike.
 */
export const buildDataGatewayConfigurationFormSchema = (isEditMode: boolean) =>
  z
    .object({
      projectKey: z.string().trim(),
      connectionString: z.string().trim().nonempty("Connection string is required"),
      databaseName: z.string().trim().nonempty("Database name is required"),
      isCollectionNameEditable: z.boolean(),
      collectionNamePattern: z.string().trim(),
      enableAnalytics: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (isEditMode) return;

      if (!data.projectKey) {
        ctx.addIssue({
          path: ["projectKey"],
          code: z.ZodIssueCode.custom,
          message: "Project key is required",
        });
      }
    });

export type DataGatewayConfigurationFormValues = z.infer<
  ReturnType<typeof buildDataGatewayConfigurationFormSchema>
>;

export const dataGatewayConfigurationFormDefaultValue: DataGatewayConfigurationFormValues = {
  projectKey: "",
  connectionString: "",
  databaseName: "",
  isCollectionNameEditable: false,
  collectionNamePattern: DEFAULT_COLLECTION_NAME_PATTERN,
  enableAnalytics: false,
};

/**
 * Maps a persisted configuration onto the form's display representation. `connectionString` is
 * deliberately never carried over - the read endpoint always masks it to "********", and
 * pre-filling that mask would risk it being saved back as the literal connection string.
 *
 * `fallbackProjectKey` seeds the Project Key field with the currently selected tenant when
 * creating a brand new configuration (a convenience default the admin can still change). It is
 * passed in explicitly, rather than baked into `dataGatewayConfigurationFormDefaultValue`, because
 * react-hook-form's `values` option (used to keep this form in sync with `configuration` across
 * dialog re-opens - see save-data-gateway-configuration.tsx) re-applies whatever this function
 * returns on every render, which would otherwise wipe out a `defaultValues`-only tenantId.
 */
export function toDataGatewayConfigurationFormValues(
  configuration?: IDataGatewayConfiguration,
  fallbackProjectKey = "",
): DataGatewayConfigurationFormValues {
  if (!configuration)
    return { ...dataGatewayConfigurationFormDefaultValue, projectKey: fallbackProjectKey };

  return {
    ...dataGatewayConfigurationFormDefaultValue,
    projectKey: configuration.projectKey,
    connectionString: "",
    databaseName: configuration.databaseName,
    isCollectionNameEditable: configuration.isCollectionNameEditable,
    collectionNamePattern: configuration.collectionNamePattern || DEFAULT_COLLECTION_NAME_PATTERN,
    enableAnalytics: configuration.analyticsConfiguration?.enableAnalytics ?? false,
  };
}
