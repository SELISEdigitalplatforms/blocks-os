import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type PageHeaderProps = {
  title: string
  description: string
  className?: string
  actions?: ReactNode
}

export const PageHeader = ({
  title,
  description,
  className,
  actions,
}: PageHeaderProps) => {
  const heading = (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--high-emphasis))] sm:text-2xl">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </>
  )

  if (!actions) {
    return (
      <header className={cn("mb-4 space-y-1 sm:mb-6", className)}>
        {heading}
      </header>
    )
  }

  return (
    <header
      className={cn(
        "mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="space-y-1">{heading}</div>
      <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>
    </header>
  )
}
