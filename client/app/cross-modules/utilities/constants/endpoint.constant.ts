const MAGIC_LINK_SUBPATH = "/MagicLink";

export const MAGIC_URL_ENDPOINTS = {
  GET: `/api/Secrets/Gets`,
  GET_LINK: `/api${MAGIC_LINK_SUBPATH}/GetLink`,
  CREATE_LINK: `/api${MAGIC_LINK_SUBPATH}/CreateLink`,
  REMOVE_LINKS: `/api${MAGIC_LINK_SUBPATH}/RemoveLinks`,
} as const;

export const SHORT_URL_BASES: Record<string, string> = {
  dev: "https://dev-short.seliseblocks.com/",
  stg: "https://stg-short.seliseblocks.com/",
  prod: "https://short.seliseblocks.com/",
};
