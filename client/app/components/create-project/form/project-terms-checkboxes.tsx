import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { useT } from "@seliseblocks/genesis-os";

/**
 * The two mandatory terms checkboxes every project creation requires: exclusive use and the
 * Terms of services link. Extracted verbatim from the wizard's naming form so the /connect
 * no-project branch shows the same wording and link, and the server receives the same flags.
 */
export const ProjectTermsCheckboxes = ({
  isAcceptBlocksTerms,
  isUseBlocksExclusively,
  onAcceptBlocksTermsChange,
  onUseBlocksExclusivelyChange,
  disabled = false,
}: {
  isAcceptBlocksTerms: boolean;
  isUseBlocksExclusively: boolean;
  onAcceptBlocksTermsChange: (checked: boolean) => void;
  onUseBlocksExclusivelyChange: (checked: boolean) => void;
  disabled?: boolean;
}) => {
  const { t } = useT("os.create-project");
  return (
    <div>
      <div className="flex gap-2">
        <Checkbox
          className="mt-[2px]"
          checked={isUseBlocksExclusively}
          onCheckedChange={(checked) => onUseBlocksExclusivelyChange(checked === true)}
          disabled={disabled}
          aria-label={t("PROJECT_TERMS_CHECKBOXES.USE_BLOCKS_EXCLUSIVELY")}
        />
        <label className="flex-1 text-sm font-medium text-black dark:text-white">
          {t("PROJECT_TERMS_CHECKBOXES.I_CONFIRM_THAT_I_WILL")}
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Checkbox
          checked={isAcceptBlocksTerms}
          onCheckedChange={(checked) => onAcceptBlocksTermsChange(checked === true)}
          disabled={disabled}
          aria-label={t("PROJECT_TERMS_CHECKBOXES.ACCEPT_THE_TERMS_OF_SERVICES")}
        />
        <label className="text-sm font-medium text-black dark:text-white">
          {t("PROJECT_TERMS_CHECKBOXES.I_ACCEPT_THE")}{" "}
          <a
            href="https://selisegroup.com/software-development-term/"
            className="text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("PROJECT_TERMS_CHECKBOXES.TERMS_OF_SERVICES")}
          </a>
        </label>
      </div>
    </div>
  );
};
