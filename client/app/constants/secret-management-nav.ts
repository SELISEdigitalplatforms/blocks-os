import { navText } from "@/constants/nav-text";
import {
  Bell,
  BrainCircuit,
  Building2,
  Database,
  Fingerprint,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Mail,
  Network,
  Plug,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  desc: string;
};

export type NavGroup = {
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
};

export const SECRET_MANAGEMENT_NAV_GROUPS: NavGroup[] = [
  {
    get label() {
      return navText("SECRET_MANAGEMENT_NAV.SECRETS_KEYS");
    },
    items: [
      {
        id: "secret-management",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.SECRET");
        },
        value: "secret",
        icon: KeyRound,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.SECURELY_MANAGE_API_AND_SERVICE");
        },
      },
      {
        id: "my-services",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.MY_SERVICES");
        },
        value: "my-services",
        icon: Layers,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.MANAGE_CONNECTED_SERVICES");
        },
      },
    ],
  },
  {
    get label() {
      return navText("SECRET_MANAGEMENT_NAV.AUTHENTICATION");
    },
    items: [
      {
        id: "oidc",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.OIDC");
        },
        value: "oidc",
        icon: ShieldCheck,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.OPENID_CONNECT_CONFIGURATION");
        },
      },
      {
        id: "client-credentials",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.CLIENT_CREDENTIALS");
        },
        value: "client-credentials",
        icon: Fingerprint,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.OAUTH_CLIENT_CREDENTIALS_FOR_SERVICE");
        },
      },
      {
        id: "identity-providers",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.IDENTITY_PROVIDER");
        },
        value: "identity-providers",
        icon: Building2,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.LET_PEOPLE_SIGN");
        },
      },
      {
        id: "sso",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.SSO");
        },
        value: "sso",
        icon: Users,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.SINGLE_SIGN_ON_PROVIDERS");
        },
      },
      {
        id: "external-idp",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.EXTERNAL_IDP");
        },
        value: "external-idp",
        icon: Globe,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.EXTERNAL_IDENTITY_PROVIDERS_CERTIFICATES");
        },
      },
      {
        id: "captcha",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.CAPTCHA");
        },
        value: "captcha",
        icon: ShieldAlert,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.BOT_PROTECTION_CONFIGURATION");
        },
      },
      {
        id: "mfa",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.MFA");
        },
        value: "mfa",
        icon: Smartphone,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.MULTI_FACTOR_AUTHENTICATION_SETTINGS");
        },
      },
      {
        id: "magic-url",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.MAGIC_URL");
        },
        value: "magic-url",
        icon: Link2,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.PASSWORDLESS_MAGIC_LINK_SETTINGS");
        },
      },
    ],
  },
  {
    get label() {
      return navText("SECRET_MANAGEMENT_NAV.COMMUNICATION");
    },
    items: [
      {
        id: "email",
        get label() {
          return navText("common:EMAIL");
        },
        value: "email",
        icon: Mail,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.EMAIL_PROVIDER_CONFIGURATION");
        },
      },
      {
        id: "notification",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.NOTIFICATION");
        },
        value: "notification",
        icon: Bell,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.PUSH_NOTIFICATION_SETTINGS");
        },
      },
    ],
  },
  {
    get label() {
      return navText("SECRET_MANAGEMENT_NAV.INTELLIGENCE");
    },
    items: [
      {
        id: "storage",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.STORAGE");
        },
        value: "storage",
        icon: Database,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.FILE_AND_OBJECT_STORAGE");
        },
      },
      {
        id: "data-gateway",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.DATA_GATEWAY");
        },
        value: "data-gateway",
        icon: Network,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.PER_PROJECT_DATA_SOURCE_CONFIGURATION");
        },
      },
      {
        id: "actions",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.ACTIONS");
        },
        value: "actions",
        icon: Zap,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.CHOOSE_WHAT_RUNS_WHEN_SOMETHING_HAPPENS");
        },
      },
      {
        id: "webhooks",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.WEBHOOKS");
        },
        value: "webhooks",
        icon: Webhook,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.SEND_ACTIONS_TO_YOUR_OWN_SYSTEMS");
        },
      },
      {
        id: "ai-models",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.AI_MODELS");
        },
        value: "ai-models",
        icon: BrainCircuit,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.AI_MODEL_INTEGRATIONS");
        },
      },
      {
        id: "integration",
        get label() {
          return navText("SECRET_MANAGEMENT_NAV.INTEGRATIONS");
        },
        value: "integration",
        icon: Plug,
        get desc() {
          return navText("SECRET_MANAGEMENT_NAV.SET_UP_THIS_PROJECTS_BLOCKS");
        },
      },
    ],
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const ALL_SECRET_MANAGEMENT_NAV_ITEMS = SECRET_MANAGEMENT_NAV_GROUPS.flatMap((g) => g.items);
