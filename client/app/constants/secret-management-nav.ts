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
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
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
    label: "Secrets & Keys",
    items: [
      {
        id: "secret-management",
        label: "Secret",
        value: "secret",
        icon: KeyRound,
        desc: "Securely manage API and service secrets for this environment",
      },
      {
        id: "my-services",
        label: "My Services",
        value: "my-services",
        icon: Layers,
        desc: "Manage connected services",
      },
    ],
  },
  {
    label: "Authentication",
    items: [
      {
        id: "oidc",
        label: "OIDC",
        value: "oidc",
        icon: ShieldCheck,
        desc: "OpenID Connect configuration",
      },
      {
        id: "client-credentials",
        label: "Client Credentials",
        value: "client-credentials",
        icon: Fingerprint,
        desc: "OAuth client credentials for service-to-service access",
      },
      {
        id: "identity-providers",
        label: "Identity Provider",
        value: "identity-providers",
        icon: Building2,
        desc: "Federated external identity providers",
      },
      {
        id: "sso",
        label: "SSO",
        value: "sso",
        icon: Users,
        desc: "Single sign-on providers",
      },
      {
        id: "external-idp",
        label: "External IdP",
        value: "external-idp",
        icon: Globe,
        desc: "External identity providers & certificates",
      },
      {
        id: "captcha",
        label: "Captcha",
        value: "captcha",
        icon: ShieldAlert,
        desc: "Bot protection configuration",
      },
      {
        id: "mfa",
        label: "MFA",
        value: "mfa",
        icon: Smartphone,
        desc: "Multi-factor authentication settings",
      },
      {
        id: "magic-url",
        label: "Magic URL",
        value: "magic-url",
        icon: Link2,
        desc: "Passwordless magic link settings",
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        id: "email",
        label: "Email",
        value: "email",
        icon: Mail,
        desc: "Email provider configuration",
      },
      {
        id: "notification",
        label: "Notification",
        value: "notification",
        icon: Bell,
        desc: "Push & notification settings",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        id: "storage",
        label: "Storage",
        value: "storage",
        icon: Database,
        desc: "File and object storage",
      },
      {
        id: "ai-models",
        label: "AI Models",
        value: "ai-models",
        icon: BrainCircuit,
        desc: "AI model integrations",
      },
    ],
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const ALL_SECRET_MANAGEMENT_NAV_ITEMS = SECRET_MANAGEMENT_NAV_GROUPS.flatMap((g) => g.items);
