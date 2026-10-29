import { MyServices } from "@blocks-identifier/pages/services/my-services";
import { useQueryState, parseAsBoolean } from "nuqs";
export default function MyServicesPage() {
  const [guideOpen, setGuideOpen] = useQueryState("guideOpen", parseAsBoolean.withDefault(false));
  return <MyServices guideOpen={guideOpen} onGuideOpenChange={setGuideOpen} />;
}
