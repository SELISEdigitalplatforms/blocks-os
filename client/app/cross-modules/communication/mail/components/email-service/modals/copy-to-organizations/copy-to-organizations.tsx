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
  joinNames,
  toCopyRequest,
  type ExistingCopies,
} from "@blocks-communication/mail/constants/share-organizations";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import {
  useCopyTemplateToOrganizations,
  useOrganizationChecklistData,
} from "@blocks-communication/mail/hooks/use-template-copy";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

interface CopyToOrganizationsDialogProps {
  /** A Default organization template (the details page offers the dialog only for those, C1). */
  template: IEmailTemplate;
  languageName: string;
  onClose: () => void;
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

/**
 * SPEC33 §4 CopyToOrgs design: give all or chosen organizations their own copy of a Default
 * organization template, keeping or replacing copies they already have. The copying runs in the
 * Worker; the dialog only starts it (H10).
 */
export function CopyToOrganizationsDialog({
  template,
  languageName,
  onClose,
}: Readonly<CopyToOrganizationsDialogProps>) {
  const { t } = useT("os.communication.mail");
  const data = useOrganizationChecklistData(template.itemId);
  const { mutateAsync: copyTemplate, isPending } = useCopyTemplateToOrganizations();
  const [allOrganizations, setAllOrganizations] = useState(false);
  const [existing, setExisting] = useState<ExistingCopies>("keep");
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(new Map());

  const templateLabel = t("EMAIL_COMMUNICATION_DETAILS.TEMPLATE_SUMMARY", {
    name: template.name ?? "",
    language: languageName,
  });
  const replaced =
    existing === "replace"
      ? [...selected].filter(([id]) => data.copies.has(id)).map(([, name]) => name)
      : [];
  const created = selected.size - replaced.length;

  const changeExisting = (value: ExistingCopies) => {
    setExisting(value);
    // With Keep, organizations that have their own copy can't stay selected.
    if (value === "keep") {
      setSelected(new Map([...selected].filter(([id]) => !data.copies.has(id))));
    }
  };

  const warning = () => {
    if (existing !== "replace") return null;
    if (allOrganizations) {
      return t("COPY_TO_ORGANIZATIONS.WARNING_ALL", { template: templateLabel });
    }
    if (replaced.length === 0) return null;
    return t("COPY_TO_ORGANIZATIONS.WARNING", {
      counts: t("COPY_TO_ORGANIZATIONS.COUNTS", {
        creates: t("COPY_TO_ORGANIZATIONS.CREATES", { count: created }),
        replaced: replaced.length,
      }),
      names: joinNames(replaced, t),
      template: templateLabel,
    });
  };
  const warningText = warning();

  const canSubmit =
    !isPending &&
    (allOrganizations || (selected.size > 0 && selected.size <= MAX_COPY_ORGANIZATIONS));

  const showFailure = (errors: unknown) =>
    showErrorToast({ errors, customMessages: templateErrorMessages(t) });

  const onCopy = async () => {
    const request = toCopyRequest(template.itemId, {
      copy: true,
      allOrganizations,
      selected,
      existing,
    });
    try {
      const res = await copyTemplate(request);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("COPY_TO_ORGANIZATIONS.STARTED"),
        });
        onClose();
        return;
      }
      // The dialog and its choices stay, so the admin can retry (C9).
      showFailure(res?.errors);
    } catch (error) {
      showFailure(isErrorWithErrors(error) ? error.errors : undefined);
    }
  };

  return (
    <DialogContent className="w-[min(760px,calc(100%-32px))] max-w-none rounded-md sm:max-w-none">
      <DialogHeader>
        <DialogTitle className="text-left">{t("COPY_TO_ORGANIZATIONS.TITLE")}</DialogTitle>
        <DialogDescription className="text-left">
          {t("COPY_TO_ORGANIZATIONS.DESCRIPTION", { template: templateLabel })}
        </DialogDescription>
      </DialogHeader>

      <RadioGroup
        aria-label={t("COPY_TO_ORGANIZATIONS.WHICH_LABEL")}
        className="flex flex-wrap gap-4"
        value={allOrganizations ? "all" : "selected"}
        onValueChange={(value) => setAllOrganizations(value === "all")}
      >
        <RadioChoice
          id="copy-all"
          value="all"
          label={t("COPY_TO_ORGANIZATIONS.ALL_ORGANIZATIONS")}
        />
        <RadioChoice
          id="copy-selected"
          value="selected"
          label={t("COPY_TO_ORGANIZATIONS.SELECTED_ORGANIZATIONS")}
        />
      </RadioGroup>

      <fieldset className="grid gap-3 rounded-md border px-4 py-3">
        <legend className="px-1 font-medium">{t("COPY_TO_ORGANIZATIONS.EXISTING_LEGEND")}</legend>
        <RadioGroup
          value={existing}
          onValueChange={(value) => changeExisting(value as ExistingCopies)}
        >
          <RadioChoice
            id="copy-keep"
            value="keep"
            label={t("COPY_TO_ORGANIZATIONS.KEEP")}
            hint={t("COPY_TO_ORGANIZATIONS.KEEP_HINT")}
          />
          <RadioChoice
            id="copy-replace"
            value="replace"
            label={t("COPY_TO_ORGANIZATIONS.REPLACE")}
            hint={t("COPY_TO_ORGANIZATIONS.REPLACE_HINT")}
          />
        </RadioGroup>
      </fieldset>

      {allOrganizations ? null : (
        <OrganizationChecklist
          idPrefix="copy-organization"
          data={data}
          existing={existing}
          selected={selected}
          onSelectedChange={setSelected}
        />
      )}

      {warningText ? (
        <p
          role="status"
          className="rounded-md bg-warning-50 px-3 py-2 text-sm leading-relaxed text-warning-800"
        >
          {warningText}
        </p>
      ) : null}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common:CANCEL")}
        </Button>
        <Button type="button" disabled={!canSubmit} onClick={() => void onCopy()}>
          {allOrganizations
            ? t("COPY_TO_ORGANIZATIONS.SUBMIT_ALL")
            : t("COPY_TO_ORGANIZATIONS.SUBMIT", { count: selected.size })}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
