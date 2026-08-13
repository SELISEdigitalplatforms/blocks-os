import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Label } from "@/components/ui-kits/label/label";
import { Button } from "@/components/ui-kits/button/button";
import type { IDomain } from "@seliseblocks/genesis-os/models";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { Info } from "lucide-react";
import { useState } from "react";

/**
 * Hosts on the platform's own domains are served by shared infrastructure that
 * belongs to no single project, and a domain that never passed validation was
 * never put on the proxy at all. Neither has anything for this dialog to offer
 * — the server enforces the same rule regardless of what is sent.
 */
const PLATFORM_DOMAINS = ["slsblx.com", "seliseblocks.com"];

export const isCustomerProvisioned = (domain: IDomain | null): boolean => {
  if (!domain?.isDomainVerified) return false;

  const host = domain.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const mainDomain = host.split(".").slice(-2).join(".").toLowerCase();

  return !PLATFORM_DOMAINS.includes(mainDomain);
};

/**
 * The API host this domain's application talks to: the environment's CNAME
 * label placed under the cookie domain. Derived only to name it in the warning
 * — the server works it out again from the record it is deleting.
 */
const apiHostFor = (domain: IDomain | null): string => {
  if (!domain?.cookieDomain) return "";

  const cnameTarget = getRuntimeEnv("BLOCKS_CNAME_BASE_URL") || "blocksapi.seliseblocks.com";
  const label = cnameTarget.split(".")[0];

  return `${label}.${domain.cookieDomain.replace(/^\./, "")}`;
};

interface DomainDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: IDomain | null;
  isPending: boolean;
  onConfirm: (deleteSharedApiHost: boolean) => void;
}

export const DomainDeleteDialog = ({
  open,
  onOpenChange,
  domain,
  isPending,
  onConfirm,
}: DomainDeleteDialogProps) => {
  const [deleteSharedApiHost, setDeleteSharedApiHost] = useState(false);
  const offerSharedApiHostOption = isCustomerProvisioned(domain);
  const apiHost = apiHostFor(domain);

  // The dialog is a single instance whose target swaps per row, so the choice
  // has to reset — otherwise a box ticked for one domain silently carries over
  // to the next one deleted. Adjusting state during render (React's documented
  // alternative to a reset effect) keeps the box correct on the first paint
  // rather than flipping it after one.
  const openedFor = open ? (domain?.domain ?? "") : null;
  const [lastOpenedFor, setLastOpenedFor] = useState(openedFor);

  if (openedFor !== lastOpenedFor) {
    setLastOpenedFor(openedFor);
    setDeleteSharedApiHost(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mr-4 w-full max-w-[425px] rounded-md">
        <DialogHeader>
          <DialogTitle className="text-left text-lg font-semibold leading-7">
            Delete Domain
          </DialogTitle>
          <DialogDescription className="mt-2 break-words text-left text-sm font-normal leading-5 text-medium-emphasis">
            Are you sure you want to delete the following domain?
          </DialogDescription>
        </DialogHeader>

        <p
          className="max-w-full truncate rounded-md bg-muted/60 px-3 py-2 font-mono text-sm font-semibold"
          title={domain?.domain}
        >
          {domain?.domain}
        </p>

        {offerSharedApiHostOption && (
          <>
            {/* What always happens, stated rather than asked */}
            <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Its web server configuration and SSL certificate are removed from the proxy. Adding
                this domain back later issues a new certificate.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-base-error bg-blocks-error-100/40 px-3 py-3">
              <Checkbox
                id="delete-shared-api-host"
                className="mt-0.5 shrink-0"
                checked={deleteSharedApiHost}
                onCheckedChange={(checked) => setDeleteSharedApiHost(checked === true)}
                disabled={isPending}
              />
              <div className="min-w-0">
                <Label htmlFor="delete-shared-api-host" className="cursor-pointer text-destructive">
                  Also remove the shared API host
                </Label>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  <span className="font-mono font-semibold">{apiHost}</span> serves the API for{" "}
                  <span className="font-semibold">every</span> domain under{" "}
                  {domain?.cookieDomain?.replace(/^\./, "")} — including domains in other projects
                  you may not be able to see. Removing it stops their API traffic until someone
                  re-runs domain configuration. Leave it unchecked unless you are certain nothing
                  else uses it.
                </p>
              </div>
            </div>
          </>
        )}

        <p className="text-sm text-medium-emphasis">This action cannot be undone.</p>

        <DialogFooter className="mt-4 flex flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending} onClick={() => onConfirm(deleteSharedApiHost)}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
