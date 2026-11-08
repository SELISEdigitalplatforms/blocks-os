import { navText } from "@/constants/nav-text";
import {
  Activity,
  Building2,
  FileCode,
  ShieldCheck,
  Lock,
  SlidersHorizontal,
  Ticket,
  Users,
} from "lucide-react";
import { NavItem, NavGroup } from "@/constants/secret-management-nav";

export type { NavItem, NavGroup };

export const AUTHENTICATION_NAV_GROUPS: NavGroup[] = [
  {
    get label() {
      return navText("AUTHENTICATION_NAV.CONFIGURATION");
    },
    items: [
      {
        id: "config",
        get label() {
          return navText("common:SETTINGS");
        },
        value: "config",
        icon: SlidersHorizontal,
        get desc() {
          return navText("AUTHENTICATION_NAV.TENANT_IAM_AUTH_ORGANIZATION");
        },
      },
    ],
  },
  {
    get label() {
      return navText("AUTHENTICATION_NAV.TEMPLATES");
    },
    items: [
      {
        id: "oidc-template",
        get label() {
          return navText("AUTHENTICATION_NAV.OIDC_TEMPLATE");
        },
        value: "oidc-template",
        icon: FileCode,
        get desc() {
          return navText("AUTHENTICATION_NAV.CONFIGURE_OIDC_TEMPLATE");
        },
      },
    ],
  },
  {
    get label() {
      return navText("AUTHENTICATION_NAV.ACCESS_CONTROL");
    },
    items: [
      {
        id: "users",
        get label() {
          return navText("AUTHENTICATION_NAV.USERS");
        },
        value: "users",
        icon: Users,
        get desc() {
          return navText("AUTHENTICATION_NAV.INVITE_MANAGE_AND_ORGANIZE_PEOPLE");
        },
      },
      {
        id: "organizations",
        get label() {
          return navText("AUTHENTICATION_NAV.ORGANIZATIONS");
        },
        value: "organizations",
        icon: Building2,
        get desc() {
          return navText("AUTHENTICATION_NAV.MANAGE_AND_ORGANIZE_ACCESS_ACROSS");
        },
      },
      {
        id: "roles",
        get label() {
          return navText("AUTHENTICATION_NAV.ROLES");
        },
        value: "roles",
        icon: ShieldCheck,
        get desc() {
          return navText("AUTHENTICATION_NAV.CREATE_AND_MANAGE_ROLES");
        },
      },
      {
        id: "permissions",
        get label() {
          return navText("AUTHENTICATION_NAV.PERMISSIONS");
        },
        value: "permissions",
        icon: Lock,
        get desc() {
          return navText("AUTHENTICATION_NAV.DEFINE_AND_MANAGE_GRANULAR_PERMISSIONS");
        },
      },
    ],
  },
  {
    get label() {
      return navText("AUTHENTICATION_NAV.ONE_CLICK_SIGNUP");
    },
    items: [
      {
        id: "signup-link-configurations",
        get label() {
          return navText("AUTHENTICATION_NAV.ONE_CLICK_SIGNUP");
        },
        value: "signup-link-configurations",
        icon: Ticket,
        get desc() {
          return navText("AUTHENTICATION_NAV.CREATE_AND_MANAGE_CONFIGURATIONS");
        },
      },
      {
        id: "signup-link-activity",
        get label() {
          return navText("AUTHENTICATION_NAV.SIGNUP_LINK_ACTIVITY");
        },
        value: "signup-link-activity",
        icon: Activity,
        get desc() {
          return navText("AUTHENTICATION_NAV.REVIEW_PER_CONFIGURATION_SIGNUP_LINK");
        },
      },
    ],
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const ALL_AUTHENTICATION_NAV_ITEMS = AUTHENTICATION_NAV_GROUPS.flatMap((g) => g.items);
