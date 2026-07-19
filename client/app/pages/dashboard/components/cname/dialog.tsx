import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IDomain } from "@seliseblocks/blocks-kit/models";
import { CheckCircle2 } from "lucide-react";
import { CNameInstruction } from "./instructions";
import { CnameValidatorProject } from "./validator-project";

interface CnameValidatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: IDomain | null;
}

export const CnameValidatorDialog = ({
  open,
  onOpenChange,
  domain,
}: CnameValidatorDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto overflow-x-hidden rounded-lg">
        <DialogHeader>
          <DialogTitle>Validate Domain</DialogTitle>
          <DialogDescription>
            Run a CNAME lookup to verify your domain configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Domain info summary */}
          <div className="min-w-0 space-y-3 rounded-md border border-border bg-muted/30 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-medium-emphasis">
                Application Domain
              </p>
              <p className="break-all text-sm font-medium text-high-emphasis">
                {domain?.domain}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-medium-emphasis">
                Cookie Domain
              </p>
              <p className="break-all text-sm text-muted-foreground">
                {domain?.cookieDomain}
              </p>
            </div>
          </div>

          {/* Error banner — only relevant while the domain is unverified */}
          {domain && !domain.isDomainVerified && (
            <div className="flex min-w-0 flex-col gap-1 rounded-sm border border-base-error bg-blocks-error-100 px-4 py-3 text-sm font-normal text-blocks-error-800">
              <p className="wrap-break-word">
                No servers found for &apos;{domain.cookieDomain}&apos;. Run a
                CNAME lookup to check your DNS configuration.
              </p>
            </div>
          )}

          {/* Success note once the domain has been verified */}
          {domain && domain.isDomainVerified && (
            <div className="flex min-w-0 items-center gap-2 rounded-sm border border-green-200 bg-green-50 px-4 py-3 text-sm font-normal text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="wrap-break-word">
                This domain is verified and ready to use.
              </p>
            </div>
          )}

          {/* DNS records the user must create before the lookup can pass */}
          {domain && !domain.isDomainVerified && (
            <CNameInstruction
              cookieDomainName={domain.cookieDomain}
              customDomain={domain.domain}
            />
          )}

          {domain && !domain.isDomainVerified && (
            <div className="flex justify-end">
              {/* Despite the API field name, Domain/Configure expects the full
                  site host (e.g. "asif.example.com") — the server derives the
                  blocksapi host from it by swapping the first label. Sending the
                  bare cookie domain fails DNS verification on the apex. */}
              <CnameValidatorProject
                isDomainVerified={domain.isDomainVerified}
                cookieDomain={domain.domain.replace(/^https?:\/\//, "")}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
