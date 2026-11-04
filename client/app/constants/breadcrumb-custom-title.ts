import { navText } from "@/constants/nav-text";

export const BREADCRUMB_CUSTOM_TITLES: Record<string, string | null> = {
  get "/app/iam/role-detail"() {
    return navText("BREADCRUMB_CUSTOM_TITLE.ROLES");
  },
  get "/app/iam/permission-detail"() {
    return navText("BREADCRUMB_CUSTOM_TITLE.PERMISSIONS");
  },
  get "/app/iam/user-detail"() {
    return navText("BREADCRUMB_CUSTOM_TITLE.USERS");
  },
  get "/app/iam/organization-detail"() {
    return navText("BREADCRUMB_CUSTOM_TITLE.ORGANIZATIONS");
  },
  "/app/iam/permission-detail/*": "/app/iam/permissions",
  "/app/iam/role-detail/*": "/app/iam/roles",
  "/app/iam/user-detail/*": "/app/iam/users",
  "/app/iam/organization-detail/*": "/app/iam/organizations",
};
