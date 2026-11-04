const DATA_GATEWAY_SUBPATH = "/DataGateway";

// DataGateway Configuration endpoints. There is at most one configuration (per the ambient
// tenant) - the controller has no list or Delete action, only GetConfig and SaveConfig.
export const DATA_GATEWAY_CONFIG_ENDPOINTS = {
  GET_CONFIG: `/api${DATA_GATEWAY_SUBPATH}/GetConfig`,
  SAVE_CONFIG: `/api${DATA_GATEWAY_SUBPATH}/SaveConfig`,
} as const;
