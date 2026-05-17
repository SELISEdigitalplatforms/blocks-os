import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  HardDrive,
  Bot,
  Shield,
  Database,
  CloudUpload,
  Mail,
  Share2,
  ChevronDown,
  Star,
  Clock,
  ArrowUp,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle/mode-toggle";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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

function barColor(p: number): string {
  if (p >= 90) return "#ef4444";
  if (p >= 75) return "#8b5cf6";
  if (p >= 50) return "#f59e0b";
  return "hsl(var(--primary))";
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
    <div className="grid grid-cols-2 gap-2 pb-1 pt-4 sm:grid-cols-4 xl:grid-cols-7">
      {ENV_LABELS.map((env) => {
        const val = envData[env];
        const p = Math.round((val / max) * 100);
        return (
          <div
            key={env}
            className="flex flex-col gap-1.5 rounded-md border bg-background p-2.5 transition-colors hover:bg-[hsl(var(--surface-app))]"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--low-emphasis))]">
              {env}
            </span>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-bold tabular-nums text-[hsl(var(--high-emphasis))]">
                {fmt(val)}
              </span>
              <span className="text-[10px] tabular-nums text-[hsl(var(--low-emphasis))]">{p}%</span>
            </div>
            <div className="h-[3px] overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${p}%`, background: "hsl(var(--primary))" }}
              />
            </div>
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
  const fillColor = barColor(p);

  return (
    <div className="border-b py-3.5 last:border-0">
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[hsl(var(--high-emphasis))]">{row.label}</span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full"
              style={{ background: fillColor }}
              initial={{ width: 0 }}
              animate={{ width: `${p}%` }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <span className="text-xs tabular-nums text-[hsl(var(--medium-emphasis))]">
            <span className="font-semibold text-[hsl(var(--high-emphasis))]">{fmt(row.total)}</span>
            {" / "}
            {fmt(row.limit)}
            <span className="ml-2 text-[hsl(var(--low-emphasis))]">({p}%)</span>
          </span>
        </div>
        <button
          onClick={onToggle}
          className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border bg-background text-[hsl(var(--medium-emphasis))] transition-all hover:border-input hover:bg-[hsl(var(--surface-app))] hover:text-[hsl(var(--high-emphasis))]"
          aria-label={expanded ? "Collapse breakdown" : "Expand breakdown"}
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-250", expanded && "rotate-180")}
          />
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="breakdown"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 border-t pt-1">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--low-emphasis))]">
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
  index,
}: {
  service: ServiceConfig;
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 + index * 0.065, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-[14px] border bg-card transition-colors hover:border-input"
    >
      {/* card header */}
      <div className="flex items-center gap-3.5 border-b px-5 py-4">
        <div className="text-muted-foreground">{service.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[hsl(var(--high-emphasis))]">{service.name}</p>
          <p className="text-xs text-[hsl(var(--medium-emphasis))]">{service.summary}</p>
        </div>
        <span className="rounded-full border bg-secondary px-2 py-1 text-[10px] font-semibold text-secondary-foreground">
          {service.badge}
        </span>
      </div>

      {/* card body */}
      <div className="px-5 pb-1">
        {service.rows.map((row) => (
          <UsageRow
            key={row.id}
            row={row}
            expanded={expandedRows.has(row.id)}
            onToggle={() => onToggleRow(row.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon,
  delay,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-[14px] border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-input"
    >
      {/* subtle top shimmer */}
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--low-emphasis))]">
          {label}
        </span>
        <div className="text-[hsl(var(--medium-emphasis))]">{icon}</div>
      </div>
      <p className="mb-2 text-3xl font-bold tabular-nums tracking-tight text-[hsl(var(--high-emphasis))]">
        {value}
      </p>
      <div className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--success))]">
        <ArrowUp className="h-3 w-3" />
        {trend}
        <span className="font-normal text-[hsl(var(--low-emphasis))]">vs last month</span>
      </div>
    </motion.div>
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
    <div className="min-h-screen bg-[hsl(var(--surface-app))]">
      {/* ── Sticky Nav ── */}
      <nav className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[59px] max-w-[1400px] items-center justify-between gap-4 px-6 sm:px-10">
          {/* Brand */}
          <Link to="/console" className="flex items-center gap-3">
            <Logo width={96} height={32} className="h-8 w-auto" />
            <div className="hidden flex-col sm:flex">
              <span className="text-[11px] text-[hsl(var(--low-emphasis))]">Subscription Usage</span>
            </div>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <ModeToggle />
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-[hsl(var(--success))]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--success))] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
              </span>
              All systems operational
            </div>
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1400px] px-6 pb-16 sm:px-10">
        {/* ── Page Hero ── */}
        <header className="py-10 sm:py-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary"
              >
                <Layers className="h-3 w-3" />
                Subscription Dashboard
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="text-3xl font-bold tracking-tight text-[hsl(var(--high-emphasis))] sm:text-4xl xl:text-5xl"
              >
                Usage Overview
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="max-w-md text-[15px] text-[hsl(var(--medium-emphasis))]"
              >
                Track your platform consumption across all services for the current billing period.
              </motion.p>
            </div>

            {/* Time range picker */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              onClick={() => setTimeRangeIdx((i) => (i + 1) % TIME_RANGES.length)}
              className="flex w-fit items-center gap-2 rounded-[10px] border bg-card px-4 py-2.5 text-sm font-medium text-[hsl(var(--high-emphasis))] transition-colors hover:border-input hover:bg-[hsl(var(--surface-app))]"
            >
              <Clock className="h-4 w-4 text-[hsl(var(--medium-emphasis))]" />
              <span className="font-mono text-sm">{TIME_RANGES[timeRangeIdx]}</span>
              <ChevronDown className="h-4 w-4 text-[hsl(var(--low-emphasis))]" />
            </motion.button>
          </div>
        </header>

        {/* ── Plan Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-8 overflow-hidden rounded-[14px] border bg-card p-5 transition-colors hover:border-input sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-6"
        >
          {/* top accent */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

          <div className="mb-4 flex flex-col gap-1 sm:mb-0">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
              <Star className="h-3 w-3" />
              Current Plan
            </div>
            <p className="text-lg font-bold tracking-tight text-[hsl(var(--high-emphasis))]">
              {plan.name}
            </p>
            <p className="text-sm text-[hsl(var(--medium-emphasis))]">
              {plan.description}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[hsl(var(--low-emphasis))]">
              <span className="font-semibold text-[hsl(var(--high-emphasis))]">{plan.capacityUsedPct}%</span>
              user capacity utilized
              <span className="mx-1">·</span>
              Renews {plan.renewsAt}
            </div>
          </div>

          <button className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all sm:w-auto">
            Manage Package
          </button>
        </motion.div>

        {/* ── Stats Grid ── */}
        <div className="mb-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              trend={s.trend}
              delay={0.15 + i * 0.05}
              icon={<StatIcon icon={s.icon} />}
            />
          ))}
        </div>

        {/* ── Services ── */}
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-base font-semibold text-[hsl(var(--high-emphasis))]">Services</h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-4">
          {services.map((service, i) => (
            <ServiceCard
              key={service.id}
              service={service}
              index={i}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs text-[hsl(var(--low-emphasis))] sm:flex-row">
          <span>
            Data refreshed every 5 minutes ·{" "}
            <Link to="#" className="underline-offset-2 hover:text-[hsl(var(--medium-emphasis))] hover:underline">
              Next billing: Jun 14, 2026
            </Link>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
            Selise Blocks · Enterprise Cloud OS
          </span>
        </footer>
      </div>
    </div>
  );
}
