import { AlertCircle, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BannerVariant = "warning" | "info" | "destructive" | "success";

const variantStyles: Record<BannerVariant, string> = {
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200",
  info:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-200",
  destructive:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200",
};

const iconColorStyles: Record<BannerVariant, string> = {
  warning: "text-amber-600 dark:text-amber-500",
  info: "text-blue-600 dark:text-blue-500",
  destructive: "text-red-600 dark:text-red-500",
  success: "text-emerald-600 dark:text-emerald-500",
};

const variantIcons: Record<BannerVariant, typeof AlertCircle> = {
  warning: TriangleAlert,
  info: Info,
  destructive: ShieldAlert,
  success: AlertCircle,
};

interface BannerProps {
  title?: ReactNode;
  children?: ReactNode;
  variant?: BannerVariant;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export const Banner = ({
  title,
  children,
  variant = "warning",
  icon,
  className,
  compact = true,
}: BannerProps) => {
  const Icon = variantIcons[variant];
  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-md border text-left",
        compact ? "px-3 py-2" : "px-4 py-3",
        variantStyles[variant],
        className,
      )}
    >
      <span className={cn("mt-0.5 flex-shrink-0", iconColorStyles[variant])}>
        {icon ?? <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <p className={cn(title && "mt-0.5")}>{children}</p> : null}
      </div>
    </div>
  );
};
