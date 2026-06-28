import { useParams } from "react-router-dom";
import { AIModelSelectedPage } from "@/cross-modules/ai/pages/ai-model-selected/aimodel-selected";
export default function AiModelSelectedRoute() {
  const { provider } = useParams<{ provider: string }>();
  return <AIModelSelectedPage provider={provider ?? ""} />;
}
