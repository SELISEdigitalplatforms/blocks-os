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
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import { OrganizationChecklist } from "@blocks-communication/mail/components/email-service/organization-checklist/organization-checklist";
import {
  MAX_COPY_ORGANIZATIONS,
  withCopiesOnly,
} from "@blocks-communication/mail/constants/share-organizations";
import {
  DEFAULT_DELETED_COPIES_NOT_STARTED,
  templateErrorMessages,
} from "@blocks-communication/mail/constants/template-errors";
import { useDeleteEmailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import {
  useDeleteTemplateAcrossOrganizations,
  useOrganizationChecklistData,
} from "@blocks-communication/mail/hooks/use-template-copy";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

interface DeleteDefaultTemplateProps {
  /** A Default organization template, in a multi-org project. */
  template: IEmailTemplate;
  languageName: string;
  organizationName: string;
  onClose: () => void;
  onDeleted: () => void;
}

const RadioChoice = ({
  id,
  value,
  label,
  hint,
}: {
  id: string;
  value: string;
  label: string;
  hint?: string;
}) => (
  <div className="flex items-start gap-3">
    <RadioGroupItem
      id={id}
      value={value}
      className="mt-0.5"
      aria-describedby={hint ? `${id}-hint` : undefined}
    />
    <div className="grid gap-0.5">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      {hint ? (
        <span id={`${id}-hint`} className="text-sm text-low-emphasis">
          {hint}
        </span>
      ) : null}
    </div>
  </div>
);

/** True when the request failed only after the server had already deleted the Default template (C5). */
const defaultTemplateWasDeleted = (errors: unknown) =>
  !!errors &&
  typeof errors === "object" &&
  Object.values(errors as Record<string, unknown>).includes(DEFAULT_DELETED_COPIES_NOT_STARTED);

/**
 * SPEC34 §4 DeleteTemplateDefault design: delete a Default organization template alone (the
 * existing delete, H1), or together with the organizations' own copies with the same name and
 * language, in all or chosen organizations (H2). The copies are deleted by the Worker.
 */
export function DeleteDefaultTemplate({
  template,
  languageName,
  organizationName,
  onClose,
  onDeleted,
}: Readonly<DeleteDefaultTemplateProps>) {
  const { t } = useT("os.communication.mail");
  const { mutateAsync: deleteTemplate, isPending: isDeletingDefault } = useDeleteEmailTemplate();
  const { mutateAsync: deleteAcross, isPending: isDeletingAcross } =
    useDeleteTemplateAcrossOrganizations();
  const [alsoCopies, setAlsoCopies] = useState(false);
  const [allOrganizations, setAllOrganizations] = useState(false);
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(new Map());
  // The copies lookup runs only once "Also delete" is chosen; the template exists, so it has an id.
  const data = useOrganizationChecklistData(alsoCopies ? template.itemId : undefined);

  const name = template.name ?? "";
  const templateLabel = t("EMAIL_COMMUNICATION_DETAILS.TEMPLATE_SUMMARY", {
    name,
    language: languageName,
  });
  const effective = withCopiesOnly(selected, data.copies);
  const selectedReady =
    effective.size > 0 &&
    effective.size <= MAX_COPY_ORGANIZATIONS &&
    !data.copiesLoading &&
    !data.copiesError;
  const isPending = isDeletingDefault || isDeletingAcross;
  const canDelete = !isPending && (!alsoCopies || allOrganizations || selectedReady);

  const showFailure = (errors: unknown) =>
    showErrorToast({ errors, customMessages: templateErrorMessages(t) });

  const deleteDefaultOnly = async () => {
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
  };

  const deleteWithCopies = async () => {
    const request = allOrganizations
      ? { templateId: template.itemId, allOrganizations: true }
      : {
          templateId: template.itemId,
          allOrganizations: false,
          organizationIds: [...effective.keys()],
        };
    const res = await deleteAcross(request);
    if (res?.isSuccess) {
      toast({
        variant: "success",
        title: t("common:SUCCESS"),
        description: t("DELETE_TEMPLATE.ACROSS_STARTED"),
      });
      onDeleted();
      return;
    }
    showFailure(res?.errors);
    // The Default template is already gone; only its copies weren't queued (C5).
    if (defaultTemplateWasDeleted(res?.errors)) onDeleted();
  };

  const onDelete = async () => {
    try {
      await (alsoCopies ? deleteWithCopies() : deleteDefaultOnly());
    } catch (error) {
      const errors = isErrorWithErrors(error) ? error.errors : undefined;
      showFailure(errors);
      if (alsoCopies && defaultTemplateWasDeleted(errors)) onDeleted();
    }
  };

  return (
    <DialogContent
      role="alertdialog"
      className="w-[min(760px,calc(100%-32px))] max-w-none max-h-[90vh] overflow-y-auto rounded-md sm:max-w-none"
    >
      <DialogHeader>
        <DialogTitle className="text-left">
          {t("DELETE_TEMPLATE.DEFAULT_TITLE", { name })}
        </DialogTitle>
        <DialogDescription className="text-left">
          {t("DELETE_TEMPLATE.DEFAULT_SUMMARY", {
            organization: organizationName,
            language: languageName,
          })}
        </DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-3 rounded-md border px-4 py-3">
        <legend className="px-1 font-medium">{t("DELETE_TEMPLATE.WHAT_LEGEND")}</legend>
        <RadioGroup
          aria-label={t("DELETE_TEMPLATE.WHAT_LEGEND")}
          value={alsoCopies ? "copies" : "default"}
          onValueChange={(value) => setAlsoCopies(value === "copies")}
        >
          <RadioChoice
            id="delete-only-default"
            value="default"
            label={t("DELETE_TEMPLATE.ONLY_DEFAULT")}
            hint={t("DELETE_TEMPLATE.ONLY_DEFAULT_HINT")}
          />
          <RadioChoice
            id="delete-also-copies"
            value="copies"
            label={t("DELETE_TEMPLATE.ALSO_COPIES")}
            hint={t("DELETE_TEMPLATE.ALSO_COPIES_HINT")}
          />
        </RadioGroup>
        {alsoCopies ? (
          <RadioGroup
            aria-label={t("COPY_TO_ORGANIZATIONS.WHICH_LABEL")}
            className="flex flex-wrap gap-4 pl-7"
            value={allOrganizations ? "all" : "selected"}
            onValueChange={(value) => setAllOrganizations(value === "all")}
          >
            <RadioChoice
              id="delete-all"
              value="all"
              label={t("COPY_TO_ORGANIZATIONS.ALL_ORGANIZATIONS")}
            />
            <RadioChoice
              id="delete-selected"
              value="selected"
              label={t("COPY_TO_ORGANIZATIONS.SELECTED_ORGANIZATIONS")}
            />
          </RadioGroup>
        ) : null}
      </fieldset>

      {alsoCopies && !allOrganizations ? (
        <OrganizationChecklist
          mode="delete"
          idPrefix="delete-organization"
          data={data}
          existing="keep"
          selected={selected}
          onSelectedChange={setSelected}
        />
      ) : null}

      <p
        role="status"
        className="rounded-md bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive"
      >
        {alsoCopies
          ? t("DELETE_TEMPLATE.DEFAULT_STATUS_COPIES", { template: templateLabel })
          : t("DELETE_TEMPLATE.DEFAULT_STATUS", { template: templateLabel })}
      </p>

      <DialogFooter className="flex flex-row gap-2">
        <Button variant="outline" onClick={onClose} autoFocus>
          {t("common:CANCEL")}
        </Button>
        <Button variant="destructive" onClick={() => void onDelete()} disabled={!canDelete}>
          {t("common:DELETE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
