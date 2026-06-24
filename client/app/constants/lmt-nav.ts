import { BarChart3, GitBranch, ScrollText, type LucideIcon } from "lucide-react";
import { NavItem, NavGroup } from "@/constants/secret-management-nav";

export type { NavItem, NavGroup };

export const LMT_BASE_PATH = "/app/services/lmt" as const;

export const LMT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Metrics",
    items: [
      {
        id: "usage",
        label: "Usage",
        value: "usage",
        icon: BarChart3,
        desc: "Monitor API call metrics and performance",
      },
    ],
  },
  {
    label: "Observability",
    items: [
      {
        id: "tracing",
        label: "Tracing",
        value: "tracing",
        icon: GitBranch,
        desc: "Trace requests across services",
      },
      {
        id: "logs",
        label: "Logs",
        value: "logs",
        icon: ScrollText,
        desc: "Search and view application logs across your services",
      },
    ],
  },
];

export const ALL_LMT_NAV_ITEMS = LMT_NAV_GROUPS.flatMap((g) => g.items);
