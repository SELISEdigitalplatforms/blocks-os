import type { ReactNode } from "react"
import { Button } from "@/components/ui-kits/button/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { Pencil } from "lucide-react"

type ConfigReadOnlyCardProps = {
  title: string
  children: ReactNode
  showEditButton?: boolean
  onEdit?: () => void
  editAction?: ReactNode
}

export const ConfigReadOnlyCard = ({
  title,
  children,
  showEditButton = true,
  onEdit,
  editAction,
}: ConfigReadOnlyCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        {title}
        {editAction}
        {!editAction && showEditButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            aria-label={`Edit ${title}`}
            onClick={onEdit}
            disabled={!onEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)
