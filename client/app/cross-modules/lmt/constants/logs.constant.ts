import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Database,
  Languages,
  LineChart,
  Network,
  Palette,
  Rocket,
  Shield,
  Wrench,
  Workflow,
} from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os";

export const LOG_SERVICE_ICONS = {
  iam: Shield,
  os: Network,
  monitor: LineChart,
  localization: Languages,
  data: Database,
  logic: Workflow,
  release: Rocket,
  utilities: Wrench,
  studio: Palette,
  agent: Bot,
} satisfies Record<LogServiceRow["icon"], LucideIcon>;

export const getLogServices = (): LogServiceRow[] => [
  {
    id: "blocks-iam",
    name: "Blocks IAM",
    routeSlug: "iam",
    icon: "iam",
    description: tStatic("os.lmt", "LOGS_CONSTANT.SIGN_IN_TOKEN_ROLE_AND"),
    status: "running",
  },
  {
    id: "blocks-os",
    name: "Blocks OS",
    routeSlug: "os",
    icon: "os",
    description: tStatic("os.lmt", "LOGS_CONSTANT.CORE_PLATFORM_AND_WORKSPACE"),
    status: "running",
  },
  {
    id: "blocks-monitor",
    name: "Blocks Monitor",
    routeSlug: "monitor",
    icon: "monitor",
    description: tStatic("os.lmt", "LOGS_CONSTANT.METRICS_ALERTS_AND_TRACE"),
    status: "running",
  },
  {
    id: "blocks-localization",
    name: "Blocks Localization",
    routeSlug: "localization",
    icon: "localization",
    description: tStatic("os.lmt", "LOGS_CONSTANT.TRANSLATION_AND_LOCALE_DELIVERY"),
    status: "running",
  },
  {
    id: "blocks-data",
    name: "Blocks Data",
    routeSlug: "data",
    icon: "data",
    description: tStatic("os.lmt", "LOGS_CONSTANT.STORAGE_SYNC_AND_DATA_PIPELINE"),
    status: "running",
  },
  {
    id: "blocks-release",
    name: "Blocks Release",
    routeSlug: "release",
    icon: "release",
    description: tStatic("os.lmt", "LOGS_CONSTANT.BUILD_PROMOTE_AND_DEPLOY_EVENTS"),
    status: "running",
  },
  {
    id: "blocks-utilities",
    name: "Blocks Utilities",
    routeSlug: "utilities",
    icon: "utilities",
    description: tStatic("os.lmt", "LOGS_CONSTANT.SHARED_HELPER_SERVICES_AND_CROSS"),
    status: "running",
  },
  {
    id: "blocks-studio",
    name: "Blocks Studio",
    routeSlug: "studio",
    icon: "studio",
    description: tStatic("os.lmt", "LOGS_CONSTANT.BUILDER_AND_WORKSPACE_EDITING_LOGS"),
    status: "running",
  },
  {
    id: "blocks-agent",
    name: "Blocks Agent",
    routeSlug: "agent",
    icon: "agent",
    description: tStatic("os.lmt", "LOGS_CONSTANT.AI_AGENT_ORCHESTRATION_AND_TOOL"),
    status: "running",
  },
];
