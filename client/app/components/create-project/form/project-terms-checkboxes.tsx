import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";

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
}) => (
  <div>
    <div className="flex gap-2">
      <Checkbox
        className="mt-[2px]"
        checked={isUseBlocksExclusively}
        onCheckedChange={(checked) => onUseBlocksExclusivelyChange(checked === true)}
        disabled={disabled}
        aria-label="Use Blocks exclusively"
      />
      <label className="flex-1 text-sm font-medium text-black dark:text-white">
        I confirm that I will use Blocks exclusively for purposes relating to my trade, business,
        craft, or profession
      </label>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <Checkbox
        checked={isAcceptBlocksTerms}
        onCheckedChange={(checked) => onAcceptBlocksTermsChange(checked === true)}
        disabled={disabled}
        aria-label="Accept the Terms of services"
      />
      <label className="text-sm font-medium text-black dark:text-white">
        I accept the{" "}
        <a
          href="https://selisegroup.com/software-development-term/"
          className="text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of services
        </a>
      </label>
    </div>
  </div>
);
