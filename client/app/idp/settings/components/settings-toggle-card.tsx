import { Card } from "@/components/ui-kits/card/card"
import { FormControl, FormItem, FormLabel } from "@/components/ui-kits/form/form"
import { Switch } from "@/components/ui-kits/switch/switch"
import { cn } from "@/lib/utils"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"

type SettingsToggleCardProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export const SettingsToggleCard = ({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: SettingsToggleCardProps) => (
  <Card>
    <FormItem className={SETTINGS_FORM_LAYOUT.toggleRow}>
      <div className={SETTINGS_FORM_LAYOUT.toggleLabelGroup}>
        <FormLabel className={SETTINGS_FORM_LAYOUT.toggleTitle}>{label}</FormLabel>
        {description ? (
          <p className={SETTINGS_FORM_LAYOUT.toggleDescription}>{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 self-start sm:self-center">
        <FormControl>
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            aria-label={label}
            className={cn(
              disabled &&
                "disabled:data-[state=checked]:border-blocks-primary-400 disabled:data-[state=checked]:bg-blocks-primary-400",
            )}
          />
        </FormControl>
      </div>
    </FormItem>
  </Card>
)
