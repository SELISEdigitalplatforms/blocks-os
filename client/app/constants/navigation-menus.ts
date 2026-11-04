import { navText } from "@/constants/nav-text";
import { Menu } from "@/models/menu-models";
import {
  // Activity,  // restore with the signup-link-activity entry below
  BarChart3,
  Bell,
  BookMinus,
  BrainCircuit,
  Building2,
  Coins,
  CreditCard,
  Database,
  Fingerprint,
  GitBranch,
  Globe,
  Home,
  Key,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Mail,
  Network,
  Package,
  Plug,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Ticket,
  Users,
  Webhook,
  Zap,
} from "lucide-react";

export const navigationMenus: Menu[] = [
  {
    id: "overview-project",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.OVERVIEW");
    },
    path: "/app/dashboard",
    icon: Home,
    get desc() {
      return navText("NAVIGATION_MENUS.PROJECT_OVERVIEW_AND_INSIGHTS");
    },
  },
  { type: "separator", id: "separator-overview" },
  {
    id: "environments",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.ENVIRONMENTS");
    },
    path: "/app/project/environments",
    icon: Package,
    get desc() {
      return navText("NAVIGATION_MENUS.MANAGE_PROJECT_ENVIRONMENTS_AND_CONFIGURATIONS");
    },
  },
  {
    id: "people",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.PEOPLE");
    },
    path: "/app/project/people",
    icon: Users,
    get desc() {
      return navText("NAVIGATION_MENUS.MANAGE_PROJECT_MEMBERS_AND_PERMISSIONS");
    },
  },
  {
    id: "repositories",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.REPOSITORIES");
    },
    path: "/app/project/repositories",
    icon: BookMinus,
    get desc() {
      return navText("NAVIGATION_MENUS.MANAGE_CODE_REPOSITORIES_AND_INTEGRATIONS");
    },
  },
  {
    id: "settings",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.PROJECT_SETTINGS");
    },
    path: "/app/project/settings",
    icon: Settings,
    get desc() {
      return navText("NAVIGATION_MENUS.CONFIGURE_PROJECT_DETAILS_AND_PREFERENCES");
    },
  },
  {
    id: "subscription-usage",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.SUBSCRIPTION_USAGE");
    },
    path: "/app/project/subscription-usage",
    icon: CreditCard,
    get desc() {
      return navText("NAVIGATION_MENUS.VIEW_SUBSCRIPTION_DETAILS_AND_USAGE");
    },
    disabled: true, // Temporarily disabled
  },
  { type: "separator", id: "separator-identity" },
  {
    id: "service-identity__secret-management",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.SECRETS_CONFIGS");
    },
    path: "/app/secret-management",
    icon: Lock,
    get desc() {
      return navText("NAVIGATION_MENUS.MANAGE_SECRETS_CONFIGS_AND_CREDENTIALS");
    },
    children: [
      {
        id: "secret-management",
        type: "menu",
        get name() {
          return navText("NAVIGATION_MENUS.SECRET");
        },
        path: "/app/secret-management/secret",
        icon: KeyRound,
        get desc() {
          return navText("NAVIGATION_MENUS.SECURELY_MANAGE_API_AND_SERVICE");
        },
      },
      {
        id: "my-services",
        type: "menu",
        get name() {
          return navText("NAVIGATION_MENUS.MY_SERVICES");
        },
        path: "/app/secret-management/my-services",
        icon: Layers,
        get desc() {
          return navText("NAVIGATION_MENUS.SERVICE_LEVEL_SECRETS_AND_CONFIGURATIONS");
        },
      },
      {
        id: "oidc",
        get name() {
          return navText("NAVIGATION_MENUS.OIDC");
        },
        type: "menu",
        path: "/app/secret-management/oidc",
        icon: ShieldCheck,
        get desc() {
          return navText("NAVIGATION_MENUS.OPENID_CONNECT_CONFIGURATIONS_AND_CLIENTS");
        },
      },
      {
        id: "client-credentials",
        get name() {
          return navText("NAVIGATION_MENUS.CLIENT_CREDENTIALS");
        },
        path: "/app/secret-management/client-credentials",
        icon: Fingerprint,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_CLIENT_CREDENTIALS_AND_ACCESS");
        },
        type: "menu",
      },
      {
        id: "identity-providers",
        get name() {
          return navText("NAVIGATION_MENUS.IDENTITY_PROVIDER");
        },
        path: "/app/secret-management/identity-providers",
        icon: Building2,
        get desc() {
          return navText("NAVIGATION_MENUS.CONFIGURE_IDENTITY_PROVIDERS_AND_FEDERATION");
        },
        type: "menu",
      },

      {
        id: "external-idp",
        get name() {
          return navText("NAVIGATION_MENUS.EXTERNAL_IDP");
        },
        path: "/app/secret-management/external-idp",
        icon: Globe,
        get desc() {
          return navText("NAVIGATION_MENUS.EXTERNAL_IDENTITY_PROVIDERS_CERTIFICATES");
        },
        type: "menu",
      },
      {
        id: "captcha",
        get name() {
          return navText("NAVIGATION_MENUS.CAPTCHA");
        },
        path: "/app/secret-management/captcha",
        icon: ShieldAlert,
        get desc() {
          return navText("NAVIGATION_MENUS.BOT_PROTECTION_CONFIGURATION");
        },
        type: "menu",
      },
      {
        id: "mfa",
        get name() {
          return navText("NAVIGATION_MENUS.MFA");
        },
        path: "/app/secret-management/mfa",
        icon: Smartphone,
        get desc() {
          return navText("NAVIGATION_MENUS.MULTI_FACTOR_AUTHENTICATION_SETTINGS");
        },
        type: "menu",
      },

      {
        id: "magic-url",
        get name() {
          return navText("NAVIGATION_MENUS.MAGIC_URL");
        },
        path: "/app/secret-management/magic-url",
        icon: Link2,
        get desc() {
          return navText("NAVIGATION_MENUS.PASSWORD_LESS_MAGIC_LINK_SETTINGS");
        },
        type: "menu",
        disabled: true, // Temporarily disabled
      },
      {
        id: "email",
        get name() {
          return navText("common:EMAIL");
        },
        path: "/app/secret-management/email",
        icon: Mail,
        get desc() {
          return navText("NAVIGATION_MENUS.EMAIL_PROVIDER_CONFIGURATION");
        },
        type: "menu",
      },
      {
        id: "notification",
        get name() {
          return navText("NAVIGATION_MENUS.NOTIFICATION");
        },
        path: "/app/secret-management/notification",
        icon: Bell,
        get desc() {
          return navText("NAVIGATION_MENUS.PUSH_NOTIFICATION_SETTINGS");
        },
        type: "menu",
      },
      {
        id: "storage",
        get name() {
          return navText("NAVIGATION_MENUS.STORAGE");
        },
        path: "/app/secret-management/storage",
        icon: Database,
        get desc() {
          return navText("NAVIGATION_MENUS.FILE_AND_OBJECT_STORAGE");
        },
        type: "menu",
      },
      {
        id: "data-gateway",
        get name() {
          return navText("NAVIGATION_MENUS.DATA_GATEWAY");
        },
        path: "/app/secret-management/data-gateway",
        icon: Network,
        get desc() {
          return navText("NAVIGATION_MENUS.PER_PROJECT_DATA_SOURCE_CONFIGURATION");
        },
        type: "menu",
      },
      {
        id: "actions",
        get name() {
          return navText("NAVIGATION_MENUS.ACTIONS");
        },
        path: "/app/secret-management/actions",
        icon: Zap,
        get desc() {
          return navText("NAVIGATION_MENUS.CHOOSE_WHAT_RUNS_WHEN_SOMETHING_HAPPENS");
        },
        type: "menu",
      },
      {
        id: "webhooks",
        get name() {
          return navText("NAVIGATION_MENUS.WEBHOOKS");
        },
        path: "/app/secret-management/webhooks",
        icon: Webhook,
        get desc() {
          return navText("NAVIGATION_MENUS.SEND_ACTIONS_TO_YOUR_OWN_SYSTEMS");
        },
        type: "menu",
      },
      {
        id: "ai-models",
        get name() {
          return navText("NAVIGATION_MENUS.AI_MODELS");
        },
        path: "/app/secret-management/ai-models",
        icon: BrainCircuit,
        get desc() {
          return navText("NAVIGATION_MENUS.AI_MODEL_INTEGRATIONS");
        },
        type: "menu",
        disabled: true, // Temporarily disabled
      },
      {
        id: "integration",
        get name() {
          return navText("NAVIGATION_MENUS.INTEGRATIONS");
        },
        path: "/app/secret-management/integration",
        icon: Plug,
        get desc() {
          return navText("NAVIGATION_MENUS.SET_UP_THIS_PROJECTS_BLOCKS");
        },
        type: "menu",
      },
    ],
  },
  {
    id: "service-identity__api-settings",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.API_SETTINGS");
    },
    path: "/app/api-settings",
    icon: Settings,
    get desc() {
      return navText("NAVIGATION_MENUS.MANAGE_API_KEYS_AND_SETTINGS");
    },
    disabled: true, // Temporarily disabled
  },
  {
    id: "service-identity__email-management",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.EMAIL_MANAGEMENT");
    },
    path: "/app/email-management",
    icon: Mail,
    get desc() {
      return navText("NAVIGATION_MENUS.MANAGE_EMAIL_TEMPLATES_AND_MAILBOX");
    },
  },
  {
    id: "service-identity__authentication",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.IDENTITY_ACCESS");
    },
    path: "/app/iam",
    icon: Key,
    children: [
      {
        id: "settings",
        get name() {
          return navText("common:SETTINGS");
        },
        path: "/app/iam/settings",
        icon: SlidersHorizontal,
        get desc() {
          return navText("NAVIGATION_MENUS.TENANT_IAM_AUTH_ORGANIZATION");
        },
        type: "menu",
      },

      {
        id: "users",
        get name() {
          return navText("NAVIGATION_MENUS.USERS");
        },
        // Path is intentionally "user" (not "users"): sidebar expansion uses
        // pathname.startsWith(menu.path), and detail pages live at
        // "/iam/user-detail/:id" which does not start with "/iam/users".
        path: "/app/iam/user",
        icon: Users,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_USERS");
        },
        type: "menu",
      },
      {
        id: "organizations",
        get name() {
          return navText("NAVIGATION_MENUS.ORGANIZATIONS");
        },
        // Path is intentionally "organization" (not "organizations"): sidebar expansion uses
        // pathname.startsWith(menu.path), and detail pages live at
        // "/iam/organization-detail/:orgId" which does not start with "/iam/organizations".
        path: "/app/iam/organization",
        icon: Building2,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_ORGANIZATIONS");
        },
        type: "menu",
      },
      {
        id: "roles",
        get name() {
          return navText("NAVIGATION_MENUS.ROLES");
        },
        // Path is intentionally "role" (not "roles"): sidebar expansion uses
        // pathname.startsWith(menu.path), and detail pages live at
        // "/iam/role-detail/:id" which does not start with "/iam/roles".
        path: "/app/iam/role",
        icon: ShieldCheck,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_ROLES");
        },
        type: "menu",
      },
      {
        id: "permissions",
        get name() {
          return navText("NAVIGATION_MENUS.PERMISSIONS");
        },
        // Path is intentionally "permission" (not "permissions"): sidebar expansion uses
        // pathname.startsWith(menu.path), and detail pages live at
        // "/iam/permission-detail/:id" which does not start with "/iam/permissions".
        path: "/app/iam/permission",
        icon: Lock,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_PERMISSIONS");
        },
        type: "menu",
      },
      {
        id: "data-access",
        get name() {
          return navText("NAVIGATION_MENUS.DATA_ACCESS");
        },
        path: "/app/iam/data-access",
        icon: Database,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_UPDATE_ACCESS_FOR_PLATFORM");
        },
        type: "menu",
      },
      {
        id: "signup-link-configurations",
        get name() {
          return navText("NAVIGATION_MENUS.ONE_CLICK_SIGNUP");
        },
        // Plural is safe here, unlike the siblings above: this screen edits in dialogs
        // rather than detail routes, so there is no sibling path for startsWith to swallow.
        // It shares the "/app/iam/signup-link" prefix with the hidden activity route below,
        // but neither path is a prefix of the other, so expansion highlights exactly one.
        path: "/app/iam/signup-link-configurations",
        icon: Ticket,
        get desc() {
          return navText("NAVIGATION_MENUS.MANAGE_CONFIGURATIONS_THAT_ONE_CLICK");
        },
        type: "menu",
      },
      // Hidden from the sidebar for now. The route, the page and its summary endpoint are
      // all still live, so /app/iam/signup-link-activity works if you go to it directly --
      // restoring the entry is uncommenting this and the Activity icon import.
      // {
      //   id: "signup-link-activity",
      //   name: "Signup Link Activity",
      //   path: "/app/iam/signup-link-activity",
      //   icon: Activity,
      //   desc: "Review per-configuration signup link activity counts",
      //   type: "menu",
      // },
    ],
  },
  { type: "separator", id: "separator-lmt" },
  {
    id: "service-identity__lmt",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.LOGS_TRACES");
    },
    path: "/app/lmt",
    icon: Zap,
    children: [
      {
        id: "usage",
        get name() {
          return navText("NAVIGATION_MENUS.USAGE");
        },
        path: "/app/lmt/usage",
        icon: BarChart3,
        get desc() {
          return navText("NAVIGATION_MENUS.MONITOR_API_CALL_METRICS");
        },
        type: "menu",
      },
      {
        id: "tracing",
        get name() {
          return navText("NAVIGATION_MENUS.TRACING");
        },
        path: "/app/lmt/tracing",
        icon: GitBranch,
        get desc() {
          return navText("NAVIGATION_MENUS.TRACE_REQUESTS_ACROSS_SERVICES");
        },
        type: "menu",
      },
      {
        id: "logs",
        get name() {
          return navText("NAVIGATION_MENUS.LOGS");
        },
        path: "/app/lmt/logs",
        icon: ScrollText,
        get desc() {
          return navText("NAVIGATION_MENUS.SEARCH_AND_VIEW_APPLICATION_LOGS");
        },
        type: "menu",
      },
    ],
  },
  { type: "separator", id: "separator-ai-credits" },
  {
    id: "ai-credits",
    type: "menu",
    get name() {
      return navText("NAVIGATION_MENUS.AI_CREDITS");
    },
    path: "/app/ai-credits",
    icon: Coins,
    get desc() {
      return navText("NAVIGATION_MENUS.AGENT_CREDIT_BALANCE_FOR_THIS");
    },
  },
];
