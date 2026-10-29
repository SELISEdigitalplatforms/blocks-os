import { Activity, Building2, FileCode, ShieldCheck, Lock, SlidersHorizontal, Ticket, Users } from "lucide-react";
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
        id: "users",
        label: "Users",
        value: "users",
        icon: Users,
        desc: "Invite, manage, and organize people across your workspace",
      },
      {
        id: "organizations",
        label: "Organizations",
        value: "organizations",
        icon: Building2,
        desc: "Manage and organize access across your workspace",
      },
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
  {
    label: "One-Click Signup",
    items: [
      {
        id: "signup-link-configurations",
        label: "One-Click Signup",
        value: "signup-link-configurations",
        icon: Ticket,
        desc: "Create and manage configurations that one-click signup links are generated from",
      },
      {
        id: "signup-link-activity",
        label: "Signup Link Activity",
        value: "signup-link-activity",
        icon: Activity,
        desc: "Review per-configuration signup link activity counts without exposing live links",
      },
    ],
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const ALL_AUTHENTICATION_NAV_ITEMS = AUTHENTICATION_NAV_GROUPS.flatMap((g) => g.items);
