import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Label } from "@/components/ui-kits/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";
import {
  useCloneTemplate,
  useGetTemplateLanguages,
} from "@blocks-communication/mail/hooks/use-email-template";
import { organizationOf } from "@blocks-communication/mail/constants/organization";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import { LockedField } from "@blocks-communication/mail/components/email-service/locked-field/locked-field";

interface CloneTemplateDialogProps {
  template: IEmailTemplate;
  organizationName: string;
  /** Multi-org projects show the template's organization. */
  showOrganization: boolean;
  onClose: () => void;
  onCloned: (itemId: string) => void;
}

const LANGUAGE_ID = "clone-template-language";

/**
 * Board CloneTemplate: the clone keeps the name and the organization and takes another language.
 * Languages the name already has in the organization are listed but disabled.
 */
export function CloneTemplateDialog({
  template,
  organizationName,
  showOrganization,
  onClose,
  onCloned,
}: CloneTemplateDialogProps) {
  const { t } = useT("os.communication.mail");
  const [language, setLanguage] = useState("");
  const { data: languages } = useGetLanguages();
  const organizationId = organizationOf(template);
  const { data: existingLanguages } = useGetTemplateLanguages(
    template.name ?? "",
    organizationId,
    true,
  );
  const { mutateAsync: cloneTemplate, isPending } = useCloneTemplate();
  const taken = new Set([...(existingLanguages ?? []), template.language ?? ""]);
  const projectLanguages = [
    ...new Map((languages ?? []).map((item) => [item.languageCode, item])).values(),
  ];

  const showFailure = (errors: unknown) =>
    showErrorToast({ errors, customMessages: templateErrorMessages(t) });

  const onClone = async () => {
    try {
      const res = await cloneTemplate({ itemId: template.itemId, language });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EMAIL_TEMPLATE_LIST.CLONED_SUCCESS"),
        });
        onCloned(res.itemId);
        return;
      }
      showFailure(res?.errors);
    } catch (error) {
      showFailure(isErrorWithErrors(error) ? error.errors : undefined);
    }
  };

  return (
    <DialogContent className="rounded-md sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle className="text-left">{t("CLONE_TEMPLATE.TITLE")}</DialogTitle>
        <DialogDescription className="text-left">
          {t("CLONE_TEMPLATE.DESCRIPTION", { name: template.name ?? "" })}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-5">
        <LockedField
          id="clone-template-name"
          label={t("common:NAME")}
          value={template.name ?? ""}
          hint={t("CLONE_TEMPLATE.NAME_HINT")}
        />
        {showOrganization ? (
          <LockedField
            id="clone-template-organization"
            label={t("TEMPLATE_ORGANIZATION.ORGANIZATION")}
            value={organizationName}
            hint={t("CLONE_TEMPLATE.ORGANIZATION_HINT")}
          />
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={LANGUAGE_ID} className="text-left font-medium text-high-emphasis">
            {t("CLONE_TEMPLATE.LANGUAGE")}
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id={LANGUAGE_ID} className="border-default h-10 shadow-none">
              <SelectValue placeholder={t("CLONE_TEMPLATE.PLACEHOLDER_LANGUAGE")} />
            </SelectTrigger>
            <SelectContent>
              {projectLanguages.map((item) =>
                taken.has(item.languageCode) ? (
                  <SelectItem key={item.languageCode} value={item.languageCode} disabled>
                    {t("CLONE_TEMPLATE.LANGUAGE_EXISTS", { language: item.languageName })}
                  </SelectItem>
                ) : (
                  <SelectItem key={item.languageCode} value={item.languageCode}>
                    {item.languageName}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <p className="text-sm text-low-emphasis">
            {showOrganization
              ? t("CLONE_TEMPLATE.LANGUAGE_HINT", { organization: organizationName })
              : t("CLONE_TEMPLATE.LANGUAGE_HINT_SINGLE")}
          </p>
        </div>
      </div>
      <DialogFooter className="flex flex-row gap-2">
        <Button variant="outline" onClick={onClose}>
          {t("common:CANCEL")}
        </Button>
        <Button onClick={onClone} disabled={!language || isPending}>
          {t("CLONE_TEMPLATE.CLONE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
