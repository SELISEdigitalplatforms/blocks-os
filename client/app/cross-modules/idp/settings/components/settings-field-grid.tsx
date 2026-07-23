import { cn } from "@/lib/utils"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import type { ReactNode } from "react"

type SettingsFieldGridProps = {
  children: ReactNode
  className?: string
}

export const SettingsFieldGrid = ({ children, className }: SettingsFieldGridProps) => (
  <div className={cn(SETTINGS_FORM_LAYOUT.fieldGrid, className)}>{children}</div>
)
