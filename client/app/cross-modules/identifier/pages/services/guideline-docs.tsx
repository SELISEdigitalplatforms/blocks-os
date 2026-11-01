import type { TFunction } from "@seliseblocks/genesis-os";

export const getMyServicesGuidelineSteps = (t: TFunction) => [
  {
    id: "0",
    description: (
      <div className="text-sm text-medium-emphasis">
        <h4 className="mb-2 text-lg font-semibold text-high-emphasis">{t("GUIDELINE_DOCS.MY_SERVICES_OVERVIEW")}</h4>
        <p>
          {t("GUIDELINE_DOCS.MY_SERVICES_LETS_YOU_REGISTER")}
        </p>
        <ul className="ml-4 mt-2 list-inside list-disc text-sm">
          <li>
            {t("GUIDELINE_DOCS.REGISTER_YOUR_SERVICE_IN_THE")}
          </li>
          <li>{t("GUIDELINE_DOCS.INSTALL_THE_NUGET_PACKAGE")}</li>
        </ul>
        <p className="mt-2 text-high-emphasis">
          {t("GUIDELINE_DOCS.SEND_STRUCTURED_LOGS_METRICS_AND")}
        </p>
      </div>
    ),
  },
  {
    id: "1",
    description: (
      <div className="text-sm text-medium-emphasis">
        <h4 className="mb-2 text-lg font-semibold text-high-emphasis">{t("GUIDELINE_DOCS.NUGET_INTEGRATION")}</h4>
        <p className="text-sm">
          {t("GUIDELINE_DOCS.INSTALL_THE_OFFICIAL_CLIENT")}
        </p>
        <p className="mt-2 font-semibold">
          {t("GUIDELINE_DOCS.PACKAGE")}
          <a
            href="https://www.nuget.org/packages/SeliseBlocks.LMT.Client#readme-body-tab"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 font-normal text-primary underline"
          >
            {t("GUIDELINE_DOCS.SELISEBLOCKS_LMT_CLIENT")}
          </a>
        </p>
        <p className="mt-2 font-semibold">{t("GUIDELINE_DOCS.FEATURES")}</p>
        <ul className="ml-4 mt-2 list-inside list-disc text-sm">
          <li>{t("GUIDELINE_DOCS.AUTOMATIC_RETRY_AND_BUFFERING_ON")}</li>
          <li>{t("GUIDELINE_DOCS.SUPPORTS_LOGS_TRACES_AND_CUSTOM")}</li>
          <li>{t("GUIDELINE_DOCS.MINIMAL_CONFIGURATION_VIA")}</li>
        </ul>
      </div>
    ),
  },
  {
    id: "2",
    description: (
      <div className="text-sm text-medium-emphasis">
        <h4 className="mb-2 text-lg font-semibold text-high-emphasis">{t("GUIDELINE_DOCS.VIEWING_YOUR_DATA")}</h4>
        <p className="text-sm">
          {t("GUIDELINE_DOCS.ONCE_THE_CLIENT_IS_ACTIVE")}
        </p>
        <ul className="mt-2 list-inside list-disc text-sm">
          <li>{t("GUIDELINE_DOCS.USE_THE_LIST_VIEW_TO")}</li>
          <li>{t("GUIDELINE_DOCS.FILTER_BY_SEVERITY_TRACE_ID")}</li>
          <li>{t("GUIDELINE_DOCS.LEVERAGE_TIME_RANGE_FILTERS_FOR")}</li>
        </ul>
      </div>
    ),
  },
];
