import { Label } from "@/components/ui-kits/label/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { useT } from "@seliseblocks/genesis-os";
import { OrganizationChecklist } from "@blocks-communication/mail/components/email-service/organization-checklist/organization-checklist";
import type {
  ExistingCopies,
  ShareChoice,
} from "@blocks-communication/mail/constants/share-organizations";
import { useOrganizationChecklistData } from "@blocks-communication/mail/hooks/use-template-copy";

interface ShareWithOrganizationsProps {
  choice: ShareChoice;
  onChange: (choice: ShareChoice) => void;
  /**
   * The template once step 1 has saved it. Before that nothing can have a copy of it, so no OWN
   * COPY markers are looked up (Q4: A).
   */
  templateId?: string;
}

/** One radio with its label and, under it, a hint the radio is described by. */
const Choice = ({
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
 * New Template step 1, Default organization, multi-org on (SPEC33 §4 TemplateForm): whether the new
 * template is also copied to other organizations. The choice stays in the page and is sent only
 * after the step-2 save (§6.4).
 */
export function ShareWithOrganizations({
  choice,
  onChange,
  templateId,
}: Readonly<ShareWithOrganizationsProps>) {
  const { t } = useT("os.communication.mail");
  const data = useOrganizationChecklistData(templateId);

  return (
    <fieldset className="grid gap-4 rounded-md border p-4">
      <legend className="px-1 font-medium text-high-emphasis">
        {t("SHARE_WITH_ORGANIZATIONS.LEGEND")}
      </legend>
      <RadioGroup
        value={choice.copy ? "copy" : "default"}
        onValueChange={(value) => onChange({ ...choice, copy: value === "copy" })}
      >
        <Choice
          id="share-only-default"
          value="default"
          label={t("SHARE_WITH_ORGANIZATIONS.ONLY_DEFAULT")}
          hint={t("SHARE_WITH_ORGANIZATIONS.ONLY_DEFAULT_HINT")}
        />
        <Choice
          id="share-copy"
          value="copy"
          label={t("SHARE_WITH_ORGANIZATIONS.COPY")}
          hint={t("SHARE_WITH_ORGANIZATIONS.COPY_HINT")}
        />
      </RadioGroup>

      {choice.copy ? (
        <div className="grid gap-4 pl-7">
          <RadioGroup
            aria-label={t("COPY_TO_ORGANIZATIONS.WHICH_LABEL")}
            className="flex flex-wrap gap-4"
            value={choice.allOrganizations ? "all" : "selected"}
            onValueChange={(value) => onChange({ ...choice, allOrganizations: value === "all" })}
          >
            <Choice
              id="share-all"
              value="all"
              label={t("COPY_TO_ORGANIZATIONS.ALL_ORGANIZATIONS")}
            />
            <Choice
              id="share-selected"
              value="selected"
              label={t("COPY_TO_ORGANIZATIONS.SELECTED_ORGANIZATIONS")}
            />
          </RadioGroup>

          {choice.allOrganizations ? null : (
            <OrganizationChecklist
              idPrefix="share-organization"
              data={data}
              existing={choice.existing}
              selected={choice.selected}
              onSelectedChange={(selected) => onChange({ ...choice, selected })}
            />
          )}

          <div className="grid gap-2">
            <span id="share-existing-label" className="text-sm font-medium text-high-emphasis">
              {t("SHARE_WITH_ORGANIZATIONS.EXISTING_LEGEND")}
            </span>
            <RadioGroup
              aria-labelledby="share-existing-label"
              value={choice.existing}
              onValueChange={(value) => {
                const existing = value as ExistingCopies;
                // With Keep, organizations that have their own copy can't stay selected.
                const selected =
                  existing === "keep"
                    ? new Map([...choice.selected].filter(([id]) => !data.copies.has(id)))
                    : choice.selected;
                onChange({ ...choice, existing, selected });
              }}
            >
              <Choice id="share-keep" value="keep" label={t("SHARE_WITH_ORGANIZATIONS.KEEP")} />
              <Choice
                id="share-replace"
                value="replace"
                label={t("SHARE_WITH_ORGANIZATIONS.REPLACE")}
              />
            </RadioGroup>
          </div>

          <p className="text-sm text-low-emphasis">{t("SHARE_WITH_ORGANIZATIONS.NOTE")}</p>
        </div>
      ) : null}
    </fieldset>
  );
}
