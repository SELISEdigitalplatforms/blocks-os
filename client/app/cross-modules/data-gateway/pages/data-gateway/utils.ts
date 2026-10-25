import { z } from "zod";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import { DEFAULT_COLLECTION_NAME_PATTERN } from "@/cross-modules/data-gateway/models/data-gateway.model";

/** Value the backend treats as "use the platform's own managed database". */
export const DEFAULT_DATA_SOURCE_VALUE = "default";

export type DataSourceChoice = "blocks" | "others";

/** A saved configuration is on its own database only when the backend says `Custom`. */
export const isCustomConnection = (configuration?: IDataGatewayConfiguration | null) =>
  configuration?.connectionType === "Custom";

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
 * Maps a saved configuration onto the form. The connection string is NEVER shown (the backend does
 * not return it): the field is always empty. `databaseName` is blanked for the Blocks database.
 */
export function toDataGatewayConfigurationFormValues(
  configuration?: IDataGatewayConfiguration | null,
): DataGatewayConfigurationFormValues {
  if (!configuration) return dataGatewayConfigurationFormDefaultValue;

  return {
    ...dataGatewayConfigurationFormDefaultValue,
    connectionString: "",
    databaseName: isCustomConnection(configuration) ? configuration.databaseName : "",
    isCollectionNameEditable: configuration.isCollectionNameEditable,
    collectionNamePattern: configuration.collectionNamePattern || DEFAULT_COLLECTION_NAME_PATTERN,
    enableAnalytics: configuration.analyticsConfiguration?.enableAnalytics ?? false,
  };
}

/**
 * Whether the entered string may stay empty: only when the saved configuration is already Custom
 * (an empty field then means "keep the saved one"). A first Custom save and a Default -> Custom
 * switch need the string.
 */
export const canOmitConnectionString = (
  source: DataSourceChoice,
  configuration?: IDataGatewayConfiguration | null,
) => source === "others" && isCustomConnection(configuration);

/** The `connectionString` of a save: "default" for Blocks DB, the entered value, or undefined = keep. */
export function toConnectionStringPayload(
  source: DataSourceChoice,
  entered: string,
  configuration?: IDataGatewayConfiguration | null,
): string | undefined {
  if (source === "blocks") return DEFAULT_DATA_SOURCE_VALUE;
  const value = entered.trim();
  if (value) return value;
  return canOmitConnectionString(source, configuration) ? undefined : "";
}
