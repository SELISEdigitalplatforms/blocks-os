import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useDeleteEmailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import {
  DEFAULT_ORGANIZATION_ID,
  organizationOf,
} from "@blocks-communication/mail/constants/organization";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import { DeleteDefaultTemplate } from "./delete-default-template";

interface DeleteTemplateDialogProps {
  template: IEmailTemplate;
  languageName: string;
  organizationName: string;
  isMultiOrgEnabled: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Deletes one template. With multi-org on, an organization's template says the Default
 * organization's template takes over (SPEC31 §4, DeleteTemplateOrg design, SPEC34 H9), and a
 * Default organization template asks what to delete: only it, or also the organizations' own
 * copies (SPEC34 §4, DeleteTemplateDefault design). With multi-org off it is the plain confirm
 * (SPEC34 H10: "the dialog shows only the confirm text").
 */
export function DeleteTemplateDialog(props: DeleteTemplateDialogProps) {
  const isDefaultTemplate = organizationOf(props.template) === DEFAULT_ORGANIZATION_ID;
  if (props.isMultiOrgEnabled && isDefaultTemplate) {
    return (
      <DeleteDefaultTemplate
        template={props.template}
        languageName={props.languageName}
        organizationName={props.organizationName}
        onClose={props.onClose}
        onDeleted={props.onDeleted}
      />
    );
  }
  return <DeleteSingleTemplate {...props} />;
}

/** An organization's template (multi-org on), or any template with multi-org off. */
function DeleteSingleTemplate({
  template,
  languageName,
  organizationName,
  isMultiOrgEnabled,
  onClose,
  onDeleted,
}: DeleteTemplateDialogProps) {
  const { t } = useT("os.communication.mail");
  const { mutateAsync: deleteTemplate, isPending } = useDeleteEmailTemplate();
  const name = template.name ?? "";

  const showFailure = (errors: unknown) =>
    showErrorToast({ errors, customMessages: templateErrorMessages(t) });

  const onDelete = async () => {
    try {
      const res = await deleteTemplate({ itemId: template.itemId });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EMAIL_TEMPLATE_LIST.DELETED_SUCCESS"),
        });
        onDeleted();
        return;
      }
      showFailure(res?.errors);
    } catch (error) {
      showFailure(isErrorWithErrors(error) ? error.errors : undefined);
    }
  };

  let title = t("EMAIL_TEMPLATE_LIST.CONFIRMATION_TITLE");
  let description = t("EMAIL_TEMPLATE_LIST.DELETE_CONFIRM", { name });
  let notice: string | null = null;
  if (isMultiOrgEnabled) {
    title = t("DELETE_TEMPLATE.TITLE");
    description = t("DELETE_TEMPLATE.ORGANIZATION_SUMMARY", {
      organization: organizationName,
      name,
      language: languageName,
    });
    notice = t("DELETE_TEMPLATE.ORGANIZATION_FALLBACK", {
      organization: organizationName,
      name,
      language: languageName,
    });
  }

  return (
    <DialogContent role="alertdialog" className="rounded-md sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle className="text-left">{title}</DialogTitle>
        <DialogDescription className="text-left">{description}</DialogDescription>
      </DialogHeader>
      {notice ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-high-emphasis">
          {notice}
        </p>
      ) : null}
      <DialogFooter className="flex flex-row gap-2">
        <Button variant="outline" onClick={onClose} autoFocus>
          {t("common:CANCEL")}
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={isPending}>
          {t("common:DELETE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
