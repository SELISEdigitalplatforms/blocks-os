import { IdentityProviderList } from "./identity-provider-list";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";

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
