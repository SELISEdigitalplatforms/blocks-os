import type { ReactNode } from "react"

export const RequiredMark = () => <span className="text-destructive"> *</span>

type RequiredFieldLabelProps = {
  children: ReactNode
  required?: boolean
}

export const RequiredFieldLabel = ({ children, required = true }: RequiredFieldLabelProps) => (
  <>
    {children}
    {required ? <RequiredMark /> : null}
  </>
)
