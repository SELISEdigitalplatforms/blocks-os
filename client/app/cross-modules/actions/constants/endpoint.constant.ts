const ACTIONS_SUBPATH = "/Actions";

export const ACTIONS_ENDPOINTS = {
  GETS: `/api${ACTIONS_SUBPATH}/Gets`,
  UPDATE: `/api${ACTIONS_SUBPATH}/Update`,
} as const;
