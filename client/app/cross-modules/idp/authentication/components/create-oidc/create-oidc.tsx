import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Form } from "@/components/ui-kits/form/form";
import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { OidcSignInSection } from "./oidc-sign-in-section";
import {
  ApplicationTypeField,
  AutoRedirectField,
  ClientNameField,
  DeviceFlowField,
  IdentityProviderField,
  PkceField,
  RedirectUrisField,
  ScopeField,
  StatusField,
  TokenLifetimesSection,
} from "./oidc-client-fields";
import { useOidcClientForm } from "./use-oidc-client-form";
import { OneTimeSecret, OneTimeSecretDialog } from "../one-time-secret-dialog";

const I18N_MODULE = "os.idp.create-oidc";

/** Creates an OIDC client in a dialog. An existing client is edited on its own page. */
export const CreateOIDC = () => {
  const { t } = useT(I18N_MODULE);
  const [open, setOpen] = useState<boolean>(false);
  const [createdSecret, setCreatedSecret] = useState<OneTimeSecret | null>(null);
  const ctl = useOidcClientForm({
    active: open,
    onSaved: (secret) => {
      setCreatedSecret(secret);
      setOpen(false);
    },
  });
  const { form, isDeviceFlowClient, isMobile, isPending } = ctl;
  const { isValid, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Its own dialog: it stays open after this form closes. */}
      <OneTimeSecretDialog secret={createdSecret} onClose={() => setCreatedSecret(null)} />
      <DialogTrigger asChild>
        <Button>
          <Plus className="aspect-square w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-2">{t("common:CREATE")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-screen max-h-[95vh] w-screen flex-col rounded-none sm:h-auto sm:max-h-[95vh] sm:w-auto sm:rounded-lg md:h-auto md:w-[640px]">
        <DialogHeader>
          <DialogTitle>{t("CREATE_OIDC.TITLE_NEW")}</DialogTitle>
          <DialogDescription>{t("CREATE_OIDC.DESCRIPTION_NEW")}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form id="oidc-form" onSubmit={ctl.submit} className="space-y-5 px-1">
              <ClientNameField ctl={ctl} />
              <DeviceFlowField ctl={ctl} />
              {!isDeviceFlowClient && <ApplicationTypeField ctl={ctl} />}
              {!isDeviceFlowClient && <RedirectUrisField ctl={ctl} />}

              {/* Status | Scope(s) | PKCE — single borderless row */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <StatusField ctl={ctl} />
                <ScopeField ctl={ctl} />
                {!isDeviceFlowClient && <PkceField ctl={ctl} />}
              </div>

              {!isDeviceFlowClient && <AutoRedirectField ctl={ctl} />}
              {!isDeviceFlowClient && !isMobile && <IdentityProviderField ctl={ctl} />}

              {/* Sign-in — not offered for device-flow clients: they never show a login page. */}
              {!isDeviceFlowClient && <OidcSignInSection form={form} tenantId={ctl.tenantId} />}

              {/* Token lifetimes — the project values, or this client's own values. An input
                  left empty in Custom still uses the project setting. */}
              <TokenLifetimesSection ctl={ctl} />
            </form>
          </Form>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
          >
            {t("common:CANCEL")}
          </Button>
          <Button
            form="oidc-form"
            type="submit"
            disabled={!isValid || isPending || isSubmitting}
            className="w-full sm:w-auto"
          >
            {t("common:ADD")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
