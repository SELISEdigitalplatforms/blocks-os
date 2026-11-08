import { Key, Shield, Users } from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os";

const MODULE = "os.idp.identity-provider";

export const PROVIDER_CONFIG: Record<
  string,
  { Icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  social: {
    Icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  byos: {
    Icon: Key,
    iconBg: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  "blocks-oidc": {
    Icon: Shield,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

export const DEFAULT_PROVIDER_CONFIG = {
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

/** At-a-glance capability tags shown on each social login's gallery card. */
export const SOCIAL_CARD_TAGS: Record<"google" | "microsoft", string[]> = {
  google: ["OAuth 2.0 / OIDC"],
  microsoft: ["Entra ID"],
};

/** Gallery copy for the two provider types that aren't public social logins. */
export const ENTERPRISE_CARD_INFO: Record<
  "blocks-oidc" | "byos",
  { label: string; description: string }
> = {
  "blocks-oidc": {
    label: "Blocks OIDC",
    get description() {
      return tStatic(MODULE, "IDENTITY_PROVIDER_VISUAL.BLOCKS_OIDC_DESCRIPTION");
    },
  },
  byos: {
    get label() {
      return tStatic(MODULE, "IDENTITY_PROVIDER_VISUAL.BYOS_LABEL");
    },
    get description() {
      return tStatic(MODULE, "IDENTITY_PROVIDER_VISUAL.BYOS_DESCRIPTION");
    },
  },
};
