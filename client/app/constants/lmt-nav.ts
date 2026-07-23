import { NavGroup, NavItem } from "@/constants/secret-management-nav";
import { BarChart3, GitBranch, ScrollText } from "lucide-react";

export type { NavGroup, NavItem };

export const LMT_BASE_PATH = "/app/lmt" as const;

export const LMT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Usage",
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
    label: "Logs & Traces",
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
