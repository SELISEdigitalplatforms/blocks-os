import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import type { ReactNode } from "react"

export type ConfigField = {
  label: string
  value: ReactNode
}

type ConfigFieldGridProps = {
  fields: ConfigField[]
}

export const ConfigFieldGrid = ({ fields }: ConfigFieldGridProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-y-8 lg:grid-cols-3">
    {fields.map((field) => (
      <div key={field.label} className="flex flex-col gap-1">
        <p className={SETTINGS_FORM_LAYOUT.fieldLabel}>{field.label}</p>
        <div className={SETTINGS_FORM_LAYOUT.fieldValue}>{field.value}</div>
      </div>
    ))}
  </div>
)
