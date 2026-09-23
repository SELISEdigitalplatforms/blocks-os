const DATA_GATEWAY_SUBPATH = "/DataGateway";

// DataGateway Configuration endpoints. The controller has no Delete action -
// configurations can only be created and updated, never removed from here.
export const DATA_GATEWAY_CONFIG_ENDPOINTS = {
  GET_CONFIGS: `/api${DATA_GATEWAY_SUBPATH}/Gets`,
  GET_CONFIG: `/api${DATA_GATEWAY_SUBPATH}/Get`,
  SAVE_CONFIG: `/api${DATA_GATEWAY_SUBPATH}/Save`,
} as const;
