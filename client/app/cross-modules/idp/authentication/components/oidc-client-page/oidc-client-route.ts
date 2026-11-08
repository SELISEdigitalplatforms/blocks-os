/** Child of the OIDC route: /secret-management/oidc/clients/:clientId edits one client. */
export const OIDC_CLIENT_ROUTE_PATH = "clients/:clientId";

/** The edit page of one OIDC client, before the project scope is added. */
export const oidcClientPath = (itemId: string) =>
  `secret-management/oidc/clients/${encodeURIComponent(itemId)}`;

export const OIDC_LIST_PATH = "secret-management/oidc";
