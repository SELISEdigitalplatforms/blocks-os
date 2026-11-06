/** The Default organization: its configurations are shared by every organization. */
export const DEFAULT_ORGANIZATION_ID = "default";

/** A configuration stored without an organization belongs to the Default organization. */
export const organizationOf = (config: { organizationId?: string | null }) =>
  config.organizationId?.trim() ? config.organizationId : DEFAULT_ORGANIZATION_ID;
