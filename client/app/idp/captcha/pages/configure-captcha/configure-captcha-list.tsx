import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CAPTCHA_PROVIDERS, ICaptchaConfig } from "../../models/captcha";
import { ConfigureCaptchaModal } from "../../modals/configure-captcha-modal";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { cn } from "@/lib/utils";
import { Pencil, Settings, ShieldCheck, ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { MaskedText } from "@/components/masked-text";
import { ReactNode } from "react";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { ToggleCaptchaStatusModal } from "@blocks-idp/captcha/modals/toggle-captcha-status-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";

const LoadingSkelton = () => (
  <div className="grid gap-4">
    {Array.from({ length: 2 }).map((_, index) => (
      <Card key={index}>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const EmptyCaptchaConfig = () => {
  return (
    <EmptyState
      icon={Settings}
      title="No configurations found"
      description="Please create a new configuration."
    />
  );
};

const Item = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-high-emphasis">{children}</div>
    </div>
  );
};

const CaptchaSwitcher = ({ enabled }: { enabled: boolean }) => (
  <span
    role="img"
    aria-label={enabled ? "Enabled" : "Disabled"}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200",
      enabled
        ? "border-emerald-500 bg-emerald-500"
        : "border-neutral-300 bg-neutral-200",
    )}
  >
    <span
      className={cn(
        "pointer-events-none inline-block size-5 translate-x-[1px] rounded-full bg-white shadow-sm transition-transform duration-200",
        enabled && "translate-x-[23px]",
      )}
    />
  </span>
);

type ConfigureCaptchaListProps = {
  isLoading: boolean;
  configurations: ICaptchaConfig[];
};
export const ConfigureCaptchaList = ({ isLoading, configurations }: ConfigureCaptchaListProps) => {
  if (isLoading) return <LoadingSkelton />;
  if (!configurations.length) return <EmptyCaptchaConfig />;
  return (
    <div className="grid gap-4">
      {configurations.map((configuration) => {
        const provider = CAPTCHA_PROVIDERS[configuration.provider];
        if (!provider) return null;
        const enabled = !!configuration.isEnable;
        const StatusIcon = enabled ? ShieldCheck : ShieldOff;
        return (
          <Card
            key={configuration.itemId}
            className={cn(
              "transition-colors",
              enabled ? "border-emerald-200/60" : "border-border",
            )}
          >
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    enabled
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <CardTitle className="truncate text-base">{provider.label}</CardTitle>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      enabled ? "text-emerald-600" : "text-muted-foreground",
                    )}
                  >
                    {enabled ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ConfigureCaptchaModal configuration={configuration}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                    </ConfigureCaptchaModal>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleCaptchaStatusModal configuration={configuration}>
                      <DialogTrigger
                        aria-label={enabled ? "Disable" : "Enable"}
                        className="inline-flex"
                      >
                        <CaptchaSwitcher enabled={enabled} />
                      </DialogTrigger>
                    </ToggleCaptchaStatusModal>
                  </TooltipTrigger>
                  <TooltipContent>{enabled ? "Disable" : "Enable"}</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent className="border-t pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Item label="Site Key">
                  <CopyToClipboardButton textToCopy={configuration.captchaKey}>
                    <MaskedText text={configuration.captchaKey} length={30} />
                  </CopyToClipboardButton>
                </Item>
                <Item label="Secret Key">
                  <CopyToClipboardButton textToCopy={configuration.captchaSecret}>
                    <MaskedText text={configuration.captchaSecret} length={30} />
                  </CopyToClipboardButton>
                </Item>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
