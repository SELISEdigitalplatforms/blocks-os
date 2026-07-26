import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Activation } from "@blocks-idp/authentication/pages/activation/activation";
import { getOptionalSearchParam } from "@/lib/search-params";

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const { code, lang } = useMemo(
    () => ({
      code: getOptionalSearchParam(searchParams, "code"),
      lang: getOptionalSearchParam(searchParams, "lang"),
    }),
    [searchParams],
  );

  return <Activation code={code} lang={lang} />;
}
