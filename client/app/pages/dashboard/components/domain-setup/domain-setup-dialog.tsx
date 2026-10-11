import { useEffect } from "react";
import { Lock, X } from "lucide-react";
import { LoadingButton } from "@seliseblocks/genesis-os/components";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useDomainSetupStream } from "@/hooks/use-domain-setup";
import type { IDomain } from "@/models/project.model";
import type { IDomainSetupGuideItem } from "@/models/domain-setup.model";
import { ConnectAppStep } from "./connect-app-step";
import { DnsRecordsStep } from "./dns-records-step";
import { SetupProgressStep } from "./setup-progress-step";
import { SetupStepper } from "./setup-stepper";

const stripProtocol = (domain: string) => domain.replace(/^https?:\/\//, "");

interface DomainSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: IDomain | null;
  guide?: IDomainSetupGuideItem;
  isGuideLoading: boolean;
}

/**
 * One dialog for every domain: a verified one (the platform default included) opens straight
 * on "Connect your app"; an unverified one walks through DNS records, the live setup run and
 * then the same connect step. Nothing is stored — the view follows the domain's status and
 * the run in progress.
 */
export const DomainSetupDialog = ({
  open,
  onOpenChange,
  domain,
  guide,
  isGuideLoading,
}: DomainSetupDialogProps) => {
  const { phase, steps, error, start, reset } = useDomainSetupStream();
  const isRunning = phase === "running";

  // Closing the tab mid-run would not stop the server, but the person would lose the outcome
  useEffect(() => {
    if (!isRunning) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isRunning]);

  if (!domain) return null;

  const host = stripProtocol(domain.domain);
  const isPlatform = guide?.isPlatformDomain ?? false;
  const view =
    phase === "succeeded" || (phase === "idle" && domain.isDomainVerified)
      ? "connect"
      : phase === "idle"
        ? "records"
        : "progress";
  // A domain that was already verified when opened has no steps left to show
  const showStepper = view !== "connect" || phase === "succeeded";

  const handleOpenChange = (next: boolean) => {
    if (!next && isRunning) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleStart = () => start(host);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(event) => isRunning && event.preventDefault()}
        onInteractOutside={(event) => isRunning && event.preventDefault()}
        className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl gap-5 overflow-y-auto overflow-x-hidden rounded-lg"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isRunning ? "Close (disabled while setup is running)" : "Close"}
          disabled={isRunning}
          onClick={() => handleOpenChange(false)}
          className="absolute right-3 top-3 h-9 w-9 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>

        <DialogHeader className="pr-8 text-left">
          <DialogTitle>
            {view === "connect" ? "Connect your app" : "Set up custom domain"}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-high-emphasis">{host}</span>
            {" · "}
            {isPlatform ? "Default domain" : `Cookie domain ${domain.cookieDomain}`}
          </DialogDescription>
        </DialogHeader>

        {showStepper && (
          <SetupStepper
            current={view === "records" ? 0 : view === "progress" ? 1 : 2}
            failed={phase === "failed"}
          />
        )}

        {view === "records" && <DnsRecordsStep guide={guide} isLoading={isGuideLoading} />}
        {view === "progress" && (
          <SetupProgressStep phase={phase} steps={steps} error={error} guide={guide} host={host} />
        )}
        {view === "connect" && (
          <ConnectAppStep guide={guide} isLoading={isGuideLoading} host={host} />
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-4">
          {view === "records" && (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                I’ll do it later
              </Button>
              <Button type="button" onClick={handleStart} disabled={!guide?.records.length}>
                I’ve added the records — Verify
              </Button>
            </>
          )}

          {view === "progress" && isRunning && (
            <>
              <span className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Please keep this window open until setup finishes.
              </span>
              <LoadingButton type="button" isLoading disabled>
                Setting up…
              </LoadingButton>
            </>
          )}

          {view === "progress" && !isRunning && (
            <>
              <Button type="button" variant="link" className="mr-auto px-0" onClick={reset}>
                ← Back to records
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={handleStart}>
                Try again
              </Button>
            </>
          )}

          {view === "connect" && (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
