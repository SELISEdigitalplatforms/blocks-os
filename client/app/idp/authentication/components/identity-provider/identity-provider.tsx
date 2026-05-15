import { useState } from "react";
import { IdentityProviderList } from "./identity-provider-list";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";
import { Button } from "@/components/ui-kits/button/button";
import { CirclePlus } from "lucide-react";

export function IdentityProviders() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Identity Providers</h2>
          <p className="text-sm text-muted-foreground">
            Connect external identity providers to enable federated login.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <CirclePlus className="h-4 w-4 sm:mr-2" />
          <span className="sr-only sm:not-sr-only sm:text-sm sm:whitespace-nowrap">
            Add Identity Provider
          </span>
        </Button>
      </div>

      <IdentityProviderList />

      <IdentityProviderFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

export { IdentityProviderFormDialog };
