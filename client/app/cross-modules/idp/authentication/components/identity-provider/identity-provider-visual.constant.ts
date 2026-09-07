import { Key, Shield, Users } from "lucide-react";

export const PROVIDER_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  social: {
    label: "Social",
    Icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  byos: {
    label: "BYOS",
    Icon: Key,
    iconBg: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  "blocks-oidc": {
    label: "Blocks OIDC",
    Icon: Shield,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

export const DEFAULT_PROVIDER_CONFIG = {
  label: "OIDC",
  Icon: Shield,
  iconBg: "bg-muted",
  iconColor: "text-muted-foreground",
  statusDot: "bg-muted-foreground/40",
};

export const PROVIDER_STATUS_DOT: Record<string, string> = {
  social: "bg-blue-500",
  byos: "bg-purple-500",
  "blocks-oidc": "bg-emerald-500",
};
