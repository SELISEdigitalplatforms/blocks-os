import { ManagedServices } from "@blocks-identifier/pages/services/managed-services";
import { useQueryState, parseAsBoolean } from "nuqs";
export default function ManagedServicesPage() {
  const [guideOpen, setGuideOpen] = useQueryState(
    "guideOpen",
    parseAsBoolean.withDefault(false),
  );
  return (
    <ManagedServices guideOpen={guideOpen} onGuideOpenChange={setGuideOpen} />
  );
}
