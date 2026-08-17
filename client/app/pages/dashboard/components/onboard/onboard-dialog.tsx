import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import type { IProject } from "@seliseblocks/genesis-os/models";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { Download, ExternalLink, Eye, EyeOff, Rocket } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CopyButton } from "./copy-button";
import {
  BLOCKS_DOCS_URL,
  maskValue,
  onboardingFileName,
  resolveOnboardingGuide,
  revealKey,
} from "./onboard-guide";
import { OnboardMarkdown } from "./onboard-markdown";

type OnboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: IProject;
};

export const OnboardDialog = ({ open, onOpenChange, project }: OnboardDialogProps) => {
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>();

  const tenantId = project?.tenantId ?? "";
  const domains = useMemo(() => project?.applications ?? [], [project?.applications]);
  // Fall back to the first domain rather than storing it in state, so a project
  // switch can never leave a stale selection behind.
  const domain = domains.find((item) => item.domain === selectedDomain) ?? domains[0] ?? null;

  /** Real values — what gets copied and downloaded, regardless of the mask. */
  const resolved = useMemo(() => resolveOnboardingGuide({ tenantId, domain }), [tenantId, domain]);
  /** What is rendered on screen; identical to `resolved` once the key is revealed. */
  const displayed = useMemo(
    () => (isKeyVisible ? resolved : resolveOnboardingGuide({ tenantId, domain, maskKey: true })),
    [isKeyVisible, resolved, tenantId, domain],
  );

  const realKey = resolved.values.X_BLOCKS_KEY;
  const maskedKey = maskValue(realKey);
  const toCopyText = useCallback(
    (code: string) => revealKey(code, maskedKey, realKey),
    [maskedKey, realKey],
  );

  const hasDomain = !resolved.missing.includes("APP_DOMAIN");

  const handleCopied = (succeeded: boolean) => {
    if (succeeded) {
      showSuccessToast({
        title: "Instructions copied",
        description: "Paste them into your coding agent to start building.",
      });
      return;
    }
    showErrorToast({ errors: { clipboard: "Could not copy the instructions." } });
  };

  const handleDownload = () => {
    const blob = new Blob([resolved.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = onboardingFileName(project?.name ?? "");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-1.5 border-b border-border-default px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" aria-hidden="true" />
            Onboard with an AI agent
          </DialogTitle>
          <DialogDescription>
            Copy this brief into Claude Code — or any coding agent — to start building on this
            project. The project key, app domain and API URL are already filled in throughout.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!hasDomain && (
            <Banner variant="warning" title="No domain configured yet">
              Add a domain to this project first — until then the brief can&apos;t fill in the app
              domain, host and API URL.
            </Banner>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {domains.length > 1 && (
              <>
                <span className="text-sm font-medium text-high-emphasis">
                  Resolve against domain
                </span>
                <Select value={domain?.domain ?? ""} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="h-9 w-full sm:w-[380px]" aria-label="Select domain">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((item) => (
                      <SelectItem key={item.domain} value={item.domain}>
                        {item.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5 text-medium-emphasis"
              aria-label={isKeyVisible ? "Hide project key" : "Show project key"}
              title="The key is masked on screen only — copying and downloading always include the real value."
              onClick={() => setIsKeyVisible((visible) => !visible)}
            >
              {isKeyVisible ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              {isKeyVisible ? "Hide key" : "Show key"}
            </Button>
          </div>

          <OnboardMarkdown markdown={displayed.markdown} toCopyText={toCopyText} />
        </div>

        <DialogFooter className="items-center border-t border-border-default px-6 py-4 sm:justify-between">
          <a
            href={BLOCKS_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
          >
            Blocks CLI documentation
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download .md
            </Button>
            <CopyButton
              text={resolved.markdown}
              label="Copy instructions"
              showLabel
              variant="default"
              onCopied={handleCopied}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
