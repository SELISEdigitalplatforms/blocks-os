import { Badge } from "@/components/ui-kits/badge/badge";
import { resultLabel } from "../utils/push-results";

/** The pill of one result code: green when delivered, red otherwise. */
export function ResultBadge({ code }: Readonly<{ code: string }>) {
  return (
    <Badge variant={code === "delivered" ? "success" : "error"} className="w-fit font-normal">
      {resultLabel(code)}
    </Badge>
  );
}
