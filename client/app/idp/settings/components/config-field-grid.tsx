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
        <p className="text-sm font-medium text-low-emphasis">{field.label}</p>
        <div className="text-base font-normal text-high-emphasis">{field.value}</div>
      </div>
    ))}
  </div>
)
