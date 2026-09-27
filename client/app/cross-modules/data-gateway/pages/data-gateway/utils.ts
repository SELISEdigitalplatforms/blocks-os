import { z } from "zod";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import { DEFAULT_COLLECTION_NAME_PATTERN } from "@/cross-modules/data-gateway/models/data-gateway.model";

/** Sentinel the backend/runtime treats as "use the platform's own managed database". */
export const DEFAULT_DATA_SOURCE_VALUE = "default";

/** A stored connection string/database name is the platform default when absent or the sentinel. */
export const isDefaultConnection = (val: string | undefined | null) =>
  !val || val === DEFAULT_DATA_SOURCE_VALUE;

export const dataGatewayConfigurationFormSchema = z.object({
  connectionString: z.string().trim(),
  databaseName: z.string().trim(),
  isCollectionNameEditable: z.boolean(),
  collectionNamePattern: z.string().trim().nonempty("Collection name pattern is required"),
  enableAnalytics: z.boolean(),
});

export type DataGatewayConfigurationFormValues = z.infer<
  typeof dataGatewayConfigurationFormSchema
>;

export const dataGatewayConfigurationFormDefaultValue: DataGatewayConfigurationFormValues = {
  connectionString: "",
  databaseName: "",
  isCollectionNameEditable: false,
  collectionNamePattern: DEFAULT_COLLECTION_NAME_PATTERN,
  enableAnalytics: false,
};

/**
 * Maps a persisted configuration onto the form's display representation. `connectionString` and
 * `databaseName` are blanked when the configuration is on the platform-managed default - the
 * "My data sources" fields only ever show a real custom value, never the "default" sentinel.
 */
export function toDataGatewayConfigurationFormValues(
  configuration?: IDataGatewayConfiguration | null,
): DataGatewayConfigurationFormValues {
  if (!configuration) return dataGatewayConfigurationFormDefaultValue;

  const isBlocksManaged = isDefaultConnection(configuration.dbConnectionString);

  return {
    ...dataGatewayConfigurationFormDefaultValue,
    connectionString: isBlocksManaged ? "" : configuration.dbConnectionString,
    databaseName: isBlocksManaged ? "" : configuration.databaseName,
    isCollectionNameEditable: configuration.isCollectionNameEditable,
    collectionNamePattern: configuration.collectionNamePattern || DEFAULT_COLLECTION_NAME_PATTERN,
    enableAnalytics: configuration.analyticsConfiguration?.enableAnalytics ?? false,
  };
}
