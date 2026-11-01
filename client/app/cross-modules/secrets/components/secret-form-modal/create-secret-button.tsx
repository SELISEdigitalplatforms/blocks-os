import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { SecretFormModal } from "./secret-form-modal";
import { useT } from "@seliseblocks/genesis-os";

/**
 * The page's primary action, rendered into the secret-management layout's header slot.
 *
 * Self-contained (trigger plus modal) so the layout does not have to hold state for a page it
 * only hosts.
 */
export function CreateSecretButton() {
  const { t } = useT("os.secrets");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" />
        <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
          {t("common:CREATE")}
        </span>
      </Button>
      {open && <SecretFormModal open={open} onOpenChange={setOpen} />}
    </>
  );
}
