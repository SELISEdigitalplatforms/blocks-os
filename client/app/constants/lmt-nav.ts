import { navText } from "@/constants/nav-text";
import { NavGroup, NavItem } from "@/constants/secret-management-nav";
import { BarChart3, GitBranch, ScrollText } from "lucide-react";

export type { NavGroup, NavItem };

// DEADCODE 2026-07-29: no importers; every usage is a local variable from useLmtBasePath(); commented pending review
// export const LMT_BASE_PATH = "/app/lmt" as const;

export const LMT_NAV_GROUPS: NavGroup[] = [
  {
    get label() {
      return navText("LMT_NAV.USAGE");
    },
    items: [
      {
        id: "usage",
        get label() {
          return navText("LMT_NAV.USAGE");
        },
        value: "usage",
        icon: BarChart3,
        get desc() {
          return navText("LMT_NAV.MONITOR_API_CALL_METRICS");
        },
      },
    ],
  },
  {
    get label() {
      return navText("LMT_NAV.LOGS_TRACES");
    },
    items: [
      {
        id: "tracing",
        get label() {
          return navText("LMT_NAV.TRACING");
        },
        value: "tracing",
        icon: GitBranch,
        get desc() {
          return navText("LMT_NAV.TRACE_REQUESTS_ACROSS_SERVICES");
        },
      },
      {
        id: "logs",
        get label() {
          return navText("LMT_NAV.LOGS");
        },
        value: "logs",
        icon: ScrollText,
        get desc() {
          return navText("LMT_NAV.SEARCH_AND_VIEW_APPLICATION_LOGS");
        },
      },
    ],
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const ALL_LMT_NAV_ITEMS = LMT_NAV_GROUPS.flatMap((g) => g.items);
