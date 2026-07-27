import { IdentityProviderList } from "./identity-provider-list";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";
import { parseAsBoolean, useQueryState } from "nuqs";

type Props = {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export function IdentityProviders({ addOpen, onAddOpenChange }: Props) {
  return (
    <div className="space-y-4">
      <IdentityProviderList />
      <IdentityProviderFormDialog open={addOpen} onOpenChange={onAddOpenChange} />
    </div>
  );
}

export { IdentityProviderFormDialog };

export function IdentityProviderPage() {
  const [addOpen, setAddOpen] = useQueryState("addIdp", parseAsBoolean.withDefault(false));
  return <IdentityProviders addOpen={addOpen} onAddOpenChange={setAddOpen} />;
}
