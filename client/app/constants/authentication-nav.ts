import { FileCode, ShieldCheck, Lock, SlidersHorizontal } from "lucide-react";
import { NavItem, NavGroup } from "@/constants/secret-management-nav";

export type { NavItem, NavGroup };

export const AUTHENTICATION_NAV_GROUPS: NavGroup[] = [
  {
    label: "Configuration",
    items: [
      {
        id: "config",
        label: "Settings",
        value: "config",
        icon: SlidersHorizontal,
        desc: "Tenant IAM, auth, organization, and signup configuration",
      },
    ],
  },
  {
    label: "Templates",
    items: [
      {
        id: "oidc-template",
        label: "OIDC Template",
        value: "oidc-template",
        icon: FileCode,
        desc: "Configure OIDC template",
      },
    ],
  },
  {
    label: "Access Control",
    items: [
      {
        id: "roles",
        label: "Roles",
        value: "roles",
        icon: ShieldCheck,
        desc: "Create and manage roles that group permissions for users",
      },
      {
        id: "permissions",
        label: "Permissions",
        value: "permissions",
        icon: Lock,
        desc: "Define and manage granular permissions for access control",
      },
    ],
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const ALL_AUTHENTICATION_NAV_ITEMS = AUTHENTICATION_NAV_GROUPS.flatMap((g) => g.items);
