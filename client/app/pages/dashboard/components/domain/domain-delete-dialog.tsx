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
import { useState } from "react";

/**
 * Hosts on the platform's own domains are served by shared infrastructure whose
 * certificates belong to no single project, and a domain that never passed
 * validation has no certificate to begin with. Neither may be offered the
 * option — the server enforces the same rule regardless of what is sent.
 */
const PLATFORM_DOMAINS = ["slsblx.com", "seliseblocks.com"];

export const canDeleteCertificate = (domain: IDomain | null): boolean => {
  if (!domain?.isDomainVerified) return false;

  const host = domain.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const mainDomain = host.split(".").slice(-2).join(".").toLowerCase();

  return !PLATFORM_DOMAINS.includes(mainDomain);
};

interface DomainDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: IDomain | null;
  isPending: boolean;
  onConfirm: (deleteCertificate: boolean) => void;
}

export const DomainDeleteDialog = ({
  open,
  onOpenChange,
  domain,
  isPending,
  onConfirm,
}: DomainDeleteDialogProps) => {
  const [deleteCertificate, setDeleteCertificate] = useState(false);
  const offerCertificateOption = canDeleteCertificate(domain);

  // The dialog is a single instance whose target swaps per row, so the choice
  // has to reset — otherwise a box ticked for one domain silently carries over
  // to the next one deleted. Adjusting state during render (React's documented
  // alternative to a reset effect) keeps the box correct on the first paint
  // rather than flipping it after one.
  const openedFor = open ? (domain?.domain ?? "") : null;
  const [lastOpenedFor, setLastOpenedFor] = useState(openedFor);

  if (openedFor !== lastOpenedFor) {
    setLastOpenedFor(openedFor);
    setDeleteCertificate(false);
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

        {offerCertificateOption && (
          <div className="flex items-start gap-3 rounded-md border border-border px-3 py-3">
            <Checkbox
              id="delete-certificate"
              className="mt-0.5"
              checked={deleteCertificate}
              onCheckedChange={(checked) => setDeleteCertificate(checked === true)}
              disabled={isPending}
            />
            <div className="min-w-0">
              <Label htmlFor="delete-certificate" className="cursor-pointer">
                Also delete the SSL certificate
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave this unchecked to keep the certificate, so adding this domain back later
                reuses it. Deleting it stops renewals, and re-adding the domain issues a new
                certificate.
              </p>
            </div>
          </div>
        )}

        <p className="text-sm text-medium-emphasis">This action cannot be undone.</p>

        <DialogFooter className="mt-4 flex flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending} onClick={() => onConfirm(deleteCertificate)}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
