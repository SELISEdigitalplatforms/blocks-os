import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Clock,
  CloudUpload,
  CreditCard,
  Database,
  HardDrive,
  Mail,
  Share2,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Card } from "@/components/ui-kits/card/card";
import { Progress } from "@/components/ui-kits/progress/progress";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvData {
  dev: number;
  staging: number;
  iat: number;
  uat: number;
  preprod: number;
  shadow: number;
  prod: number;
}

interface UsageRowItem {
  id: string;
  label: string;
  total: number;
  limit: number;
  envData: EnvData;
}

interface ServiceConfig {
  id: string;
  name: string;
  badge: string;
  summary: string;
  color: string;
  icon: React.ReactNode;
  rows: UsageRowItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return n.toLocaleString();
}

function pct(total: number, limit: number): number {
  return Math.round((total / limit) * 100);
}

function progressIndicator(p: number): string {
  if (p >= 90) return "bg-destructive";
  if (p >= 75) return "bg-purple-500";
  return "";
}

// ─── Mock Data (replace with API response once endpoint is ready) ────────────
// TODO: swap MOCK_* constants below with the real hook:
// const { data, isLoading } = useGetSubscriptionUsage({ range: TIME_RANGES[timeRangeIdx] });

const MOCK_PLAN = {
  name: "Enterprise Plan",
  description: "Full access to all services with 3,000 user capacity",
  capacityUsedPct: 47,
  renewsAt: "Jun 14, 2026",
};

const MOCK_STATS = [
  { label: "Total Users",      value: "1,420",  trend: "+12%", icon: "users" },
  { label: "Storage Used",     value: "847 GB", trend: "+8%",  icon: "hdd"   },
  { label: "Active Workflows", value: "134",    trend: "+23%", icon: "share" },
  { label: "AI Credits Used",  value: "8.2M",   trend: "+31%", icon: "bot"   },
] as const;

const MOCK_SERVICES: ServiceConfig[] = [
  {
    id: "iam",
    name: "Identity Service",
    badge: "IAM",
    summary: "1,420 / 3,000 users · 47%",
    color: "#3b82f6",
    icon: <Shield className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    rows: [
      {
        id: "iam-users",
        label: "Registered Users",
        total: 1420,
        limit: 3000,
        envData: { dev: 177, staging: 142, iat: 71, uat: 99, preprod: 85, shadow: 57, prod: 789 },
      },
      {
        id: "iam-apps",
        label: "Applications",
        total: 84,
        limit: 200,
        envData: { dev: 10, staging: 8, iat: 4, uat: 6, preprod: 5, shadow: 3, prod: 48 },
      },
    ],
  },
  {
    id: "uds",
    name: "Unified Data Service",
    badge: "UDS",
    summary: "412 GB / 1 TB · 41%",
    color: "#8b5cf6",
    icon: <Database className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    rows: [
      {
        id: "uds-schemas",
        label: "Schemas",
        total: 67,
        limit: 150,
        envData: { dev: 12, staging: 8, iat: 5, uat: 7, preprod: 4, shadow: 3, prod: 29 },
      },
      {
        id: "uds-collections",
        label: "Collections",
        total: 12,
        limit: 50,
        envData: { dev: 2, staging: 1, iat: 1, uat: 1, preprod: 1, shadow: 0, prod: 6 },
      },
      {
        id: "uds-documents",
        label: "Documents",
        total: 24891,
        limit: 50000,
        envData: { dev: 4978, staging: 3734, iat: 1867, uat: 2489, preprod: 1867, shadow: 1245, prod: 12445 },
      },
      {
        id: "uds-storage",
        label: "Storage (MB)",
        total: 284,
        limit: 500,
        envData: { dev: 62, staging: 43, iat: 28, uat: 31, preprod: 22, shadow: 14, prod: 160 },
      },
    ],
  },
  {
    id: "ai",
    name: "AI Service",
    badge: "ML/AI",
    summary: "8 agents · 8.2M credits · 68%",
    color: "#f59e0b",
    icon: <Bot className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    rows: [
      {
        id: "ai-agents",
        label: "AI Agents",
        total: 8,
        limit: 20,
        envData: { dev: 2, staging: 1, iat: 1, uat: 1, preprod: 1, shadow: 0, prod: 3 },
      },
      {
        id: "ai-credits",
        label: "Credits Used",
        total: 8200000,
        limit: 12000000,
        envData: { dev: 1722000, staging: 1230000, iat: 820000, uat: 984000, preprod: 738000, shadow: 492000, prod: 4920000 },
      },
    ],
  },
  {
    id: "deploy",
    name: "Deployments",
    badge: "CI/CD",
    summary: "22 containers · 78%",
    color: "#06b6d4",
    icon: <CloudUpload className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    rows: [
      {
        id: "deploy-containers",
        label: "Containers",
        total: 22,
        limit: 30,
        envData: { dev: 4, staging: 4, iat: 3, uat: 3, preprod: 2, shadow: 1, prod: 15 },
      },
      {
        id: "deploy-runs",
        label: "Deployments",
        total: 156,
        limit: 500,
        envData: { dev: 31, staging: 31, iat: 24, uat: 18, preprod: 12, shadow: 8, prod: 52 },
      },
    ],
  },
  {
    id: "comm",
    name: "Communication",
    badge: "Messaging",
    summary: "4 templates · 14,220 sent · 28%",
    color: "#ec4899",
    icon: <Mail className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    rows: [
      {
        id: "comm-templates",
        label: "Templates",
        total: 4,
        limit: 50,
        envData: { dev: 1, staging: 1, iat: 0, uat: 1, preprod: 0, shadow: 0, prod: 2 },
      },
      {
        id: "comm-sent",
        label: "Messages Sent",
        total: 14220,
        limit: 50000,
        envData: { dev: 1422, staging: 1422, iat: 711, uat: 1422, preprod: 711, shadow: 0, prod: 8532 },
      },
    ],
  },
  {
    id: "workflow",
    name: "Workflows",
    badge: "Automation",
    summary: "134 active · 2,840 runs · 52%",
    color: "#14b8a6",
    icon: <Share2 className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    rows: [
      {
        id: "wf-active",
        label: "Active Workflows",
        total: 134,
        limit: 250,
        envData: { dev: 24, staging: 20, iat: 12, uat: 16, preprod: 10, shadow: 6, prod: 54 },
      },
      {
        id: "wf-runs",
        label: "Workflow Runs",
        total: 2840,
        limit: 5000,
        envData: { dev: 426, staging: 369, iat: 213, uat: 255, preprod: 170, shadow: 113, prod: 1420 },
      },
    ],
  },
];

const ENV_LABELS: (keyof EnvData)[] = ["dev", "staging", "iat", "uat", "preprod", "shadow", "prod"];

const TIME_RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "This billing cycle"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function EnvBreakdown({ envData }: { envData: EnvData }) {
  const max = Math.max(...Object.values(envData), 1);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {ENV_LABELS.map((env) => {
        const val = envData[env];
        const p = Math.round((val / max) * 100);
        return (
          <div key={env} className="rounded-sm border bg-muted/30 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {env}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums">{fmt(val)}</p>
            <Progress value={p} className="mt-1.5 h-1" />
          </div>
        );
      })}
    </div>
  );
}

function UsageRow({
  row,
  expanded,
  onToggle,
}: {
  row: UsageRowItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const p = pct(row.total, row.limit);

  return (
    <div className="border-b py-3.5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{row.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {fmt(row.total)} / {fmt(row.limit)}
            </span>
          </div>
          <Progress
            value={p}
            className="mt-2 h-1.5"
            indicatorClassName={progressIndicator(p) || undefined}
          />
          <p className="mt-1 text-xs text-muted-foreground">{p}% utilized</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onToggle}
          aria-label={expanded ? "Collapse breakdown" : "Expand breakdown"}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")}
          />
        </Button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="breakdown"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 border-t pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Environment Breakdown
              </p>
              <EnvBreakdown envData={row.envData} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ServiceCard({
  service,
  expandedRows,
  onToggleRow,
}: {
  service: ServiceConfig;
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3 border-b pb-4">
        <div className="text-muted-foreground">{service.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{service.name}</p>
          <p className="text-xs text-muted-foreground">{service.summary}</p>
        </div>
        <Badge variant="secondary">{service.badge}</Badge>
      </div>
      <div>
        {service.rows.map((row) => (
          <UsageRow
            key={row.id}
            row={row}
            expanded={expandedRows.has(row.id)}
            onToggle={() => onToggleRow(row.id)}
          />
        ))}
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
        <ArrowUp className="h-3 w-3" />
        <span>{trend}</span>
        <span className="font-normal text-muted-foreground">vs last month</span>
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Icon lookup used by MOCK_STATS
function StatIcon({ icon }: { icon: string }) {
  if (icon === "users") return <Users className="h-5 w-5" strokeWidth={1.8} />;
  if (icon === "hdd")   return <HardDrive className="h-5 w-5" strokeWidth={1.8} />;
  if (icon === "share") return <Share2 className="h-5 w-5" strokeWidth={1.8} />;
  return <Bot className="h-5 w-5" strokeWidth={1.8} />;
}

export function SubscriptionUsagePage() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [timeRangeIdx, setTimeRangeIdx] = useState(1);

  // ── API call (commented out until backend endpoint is ready) ──────────────
  // const { data, isLoading } = useGetSubscriptionUsage({ range: TIME_RANGES[timeRangeIdx] });
  // const plan     = data?.plan     ?? MOCK_PLAN;
  // const stats    = data?.stats    ?? MOCK_STATS;
  // const services = data?.services ?? MOCK_SERVICES;

  // ── Using mock data for now ───────────────────────────────────────────────
  const plan     = MOCK_PLAN;
  const stats    = MOCK_STATS;
  const services = MOCK_SERVICES;

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold md:text-xl">Subscription Usage</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track platform consumption across all services for the current billing period.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => setTimeRangeIdx((i) => (i + 1) % TIME_RANGES.length)}
        >
          <Clock className="h-4 w-4" />
          {TIME_RANGES[timeRangeIdx]}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* ── Plan Card ── */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CreditCard className="h-[18px] w-[18px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{plan.name}</p>
                <Badge variant="secondary" className="text-[10px]">
                  Active
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{plan.capacityUsedPct}%</span>{" "}
                capacity utilized · Renews {plan.renewsAt}
              </p>
            </div>
          </div>
          <Button  size="sm" className="shrink-0">
            Manage Package
          </Button>
        </div>
      </Card>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            trend={s.trend}
            icon={<StatIcon icon={s.icon} />}
          />
        ))}
      </div>

      {/* ── Services ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Services
          </h5>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex flex-col gap-4">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-xs text-muted-foreground">
        Data refreshed every 5 minutes · Next billing: Jun 14, 2026
      </p>
    </main>
  );
}
