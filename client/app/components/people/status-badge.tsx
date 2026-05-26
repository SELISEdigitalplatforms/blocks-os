import { Badge } from "@/components/ui-kits/badge/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
}

export const PeopleStatusBadge = ({ status, className }: StatusBadgeProps) => {
  const getVariant = (value: string) => {
    switch (value.toLowerCase()) {
      case "active":
        return "success"
      case "pending":
      case "pending invite":
        return "secondary"
      case "inactive":
        return "error"
      default:
        return "secondary"
    }
  }

  return (
    <Badge
      className={cn("w-24 justify-center whitespace-nowrap rounded-xl text-center", className)}
      variant={getVariant(status)}
    >
      {status}
    </Badge>
  )
}
