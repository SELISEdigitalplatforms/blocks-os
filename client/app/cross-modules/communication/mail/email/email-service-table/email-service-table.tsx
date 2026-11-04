import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { PageHeader } from "@/components/page-header/page-header";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { EMAIL_TAB_KEYS, type EmailTabKey } from "@blocks-communication/mail/constants/email-tabs";
import { EmailTemplateList } from "@blocks-communication/mail/email/email-service-table/email-template-list";
import { EmailUsageList } from "@blocks-communication/mail/email/email-usage/email-usage-list";
import { useGetEmailSecretConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import {
  EMAIL_ORGANIZATION_PARAM,
  useEmailOrganization,
  useOrganizationName,
} from "@blocks-communication/mail/hooks/use-email-organization";
import { EmailOrganizationPicker } from "@blocks-communication/mail/components/email-service/email-organization-picker/email-organization-picker";
import { DEFAULT_ORGANIZATION_ID } from "@blocks-communication/mail/constants/organization";
import { useGetEmailTemplates } from "@blocks-communication/mail/hooks/use-email-template";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import { CirclePlus } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useRef } from "react";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { useT } from "@seliseblocks/genesis-os";
import { useEmailUsageFilterQueryParams } from "../email-usage/email-usage-filter-toolbar";
import { useQueryState } from "nuqs";
import {
  TemplateFilterToolbar,
  useTemplatesFilterQueryParams,
  useTemplatesSortQueryParams,
} from "./template-filter-toolbar";

const DEFAULT_EMAIL_TAB: EmailTabKey = "Emailstemplates";

const isEmailTabKey = (value: string | null): value is EmailTabKey =>
  value !== null && (EMAIL_TAB_KEYS as readonly string[]).includes(value);

const LoadingSkelton = () => {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded" />
      ))}
    </div>
  );
};
/** Whether the list is narrowed, in which case an empty result is not "no templates yet". */
const hasFilters = (params: { search?: string; language?: string; mailConfigurationId?: string }) =>
  !!(params.search || params.language || params.mailConfigurationId);
interface EmailServiceTableProps {
  onRowClick?: (id: string | number) => void;
}
export function EmailServiceTable({ onRowClick }: EmailServiceTableProps = {}) {
  const { t } = useT("os.communication.mail");
  const tabLabels: Record<EmailTabKey, string> = {
    Emailstemplates: t("EMAIL_SERVICE_TABLE.TAB_TEMPLATES"),
    Inbox: t("EMAIL_SERVICE_TABLE.TAB_INCOMING_MAILS"),
    Outgoingmails: t("EMAIL_SERVICE_TABLE.TAB_OUTGOING_MAILS"),
  };
  const tabMeta: Record<EmailTabKey, { title: string; description: string }> = {
    Emailstemplates: {
      title: t("EMAIL_SERVICE_TABLE.TITLE_TEMPLATES"),
      description: t("EMAIL_SERVICE_TABLE.DESCRIPTION_TEMPLATES"),
    },
    Inbox: {
      title: t("EMAIL_SERVICE_TABLE.TAB_INCOMING_MAILS"),
      description: t("EMAIL_SERVICE_TABLE.DESCRIPTION_INCOMING_MAILS"),
    },
    Outgoingmails: {
      title: t("EMAIL_SERVICE_TABLE.TAB_OUTGOING_MAILS"),
      description: t("EMAIL_SERVICE_TABLE.DESCRIPTION_OUTGOING_MAILS"),
    },
  };
  const tabs = EMAIL_TAB_KEYS.map((value) => ({ value, label: tabLabels[value] }));
  const { queryParams, setQueryParams } = useTemplatesFilterQueryParams();
  const { sortQueryParams } = useTemplatesSortQueryParams();
  const organization = useEmailOrganization();
  const organizationId = organization.selectedOrganizationId;
  // Another organization has its own pages and configurations: start it on page 1 with no
  // configuration filter, so a page or filter of the previous one never empties the list.
  const shownOrganizationId = useRef(organizationId);
  useEffect(() => {
    if (shownOrganizationId.current === organizationId) return;
    shownOrganizationId.current = organizationId;
    setQueryParams((prev) => ({ ...prev, pageNumber: 0, mailConfigurationId: "" }));
  }, [organizationId, setQueryParams]);
  const organizationName = useOrganizationName(organizationId);
  const { isLoading, isError, refetch, data } = useGetEmailTemplates(
    queryParams.pageNumber ?? 0,
    queryParams.pageSize ?? 10,
    queryParams.search ?? "",
    sortQueryParams.property ?? "Name",
    sortQueryParams.isDescending ?? false,
    queryParams.language ?? "",
    queryParams.mailConfigurationId ?? "",
    organizationId,
  );
  // The organization's configurations and the Default organization's: the filter, the
  // Configuration column and its "via" line all read this one list.
  const { isLoading: isConfigsLoading, data: configsResponse } =
    useGetEmailSecretConfigs(organizationId);
  const emailConfigsData = configsResponse?.configurations;
  const { isLoading: isLanguageListLoading, data: languageListData } = useGetLanguages();
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { setQueryParams: setEmailUsageQueryParams } = useEmailUsageFilterQueryParams();
  const [emailTab, setEmailTab] = useQueryState("emailTab", {
    defaultValue: DEFAULT_EMAIL_TAB,
  });
  const activeTab: EmailTabKey = isEmailTabKey(emailTab) ? emailTab : DEFAULT_EMAIL_TAB;
  const activeTabMeta = tabMeta[activeTab];

  const handleTabChange = (value: string) => {
    void setEmailTab(value);
    setQueryParams(null);
    setEmailUsageQueryParams(null);
  };

  const onPageChangeHandler = (pageNumber: number) => {
    setQueryParams((prev) => ({
      ...prev,
      pageNumber,
    }));
  };
  const onPageSizeChangeHandler = (pageSize: number) => {
    setQueryParams((prev) => ({
      ...prev,
      pageSize,
      pageNumber: 0,
    }));
  };
  // New Template opens in the page's organization (the same URL parameter as the picker).
  const newTemplatePath = () => {
    const path = scoped("email-management/new-communication");
    return organization.isMultiOrgEnabled && organizationId !== DEFAULT_ORGANIZATION_ID
      ? `${path}?${EMAIL_ORGANIZATION_PARAM}=${encodeURIComponent(organizationId)}`
      : path;
  };
  const totalCount = data?.totalCount ?? 0;
  const pageSize = queryParams.pageSize ?? 10;
  const pageNumber = queryParams.pageNumber ?? 0;
  const pageFrom = totalCount === 0 ? 0 : pageNumber * pageSize + 1;
  const pageTo = Math.min(totalCount, (pageNumber + 1) * pageSize);
  const showFallbackHint =
    organization.isMultiOrgEnabled && organizationId !== DEFAULT_ORGANIZATION_ID;
  const countLabel = organization.isMultiOrgEnabled
    ? t("EMAIL_SERVICE_TABLE.ORGANIZATION_TEMPLATE_COUNT", {
        organization: organizationName,
        count: totalCount,
      })
    : t("EMAIL_SERVICE_TABLE.TEMPLATE_COUNT", { count: totalCount });
  const isEmpty =
    !isLoading &&
    !isError &&
    !!data &&
    totalCount === 0 &&
    !data.templates?.length &&
    !hasFilters(queryParams);
  const handleRowClick = (emailId: number | string) => {
    if (onRowClick) {
      onRowClick(emailId);
    } else {
      navigate(scoped(`email-management/communications/${emailId}`));
    }
  };
  const tableData = useMemo(() => {
    if (!data?.templates) return [];
    return data.templates;
  }, [data]);
  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex w-full flex-col">
          <PageHeader title={activeTabMeta.title} description={activeTabMeta.description} />

          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3">
            <div className="flex min-w-0 items-center gap-4">
              <div className="md:hidden">
                <Select
                  value={activeTab}
                  onValueChange={(value) => handleTabChange(value as EmailTabKey)}
                >
                  <SelectTrigger
                    className="w-56"
                    aria-label={t("EMAIL_SERVICE_TABLE.SECTION_ARIA_LABEL")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tabs.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden items-center md:flex">
                <TabsList className="h-[42px] bg-blocks-primary-shades-300">
                  {tabs.map(({ value, label }) => (
                    <TabsTrigger key={value} value={value} className="h-8 px-4 text-sm">
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {activeTab === "Emailstemplates" ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {organization.isMultiOrgEnabled ? <EmailOrganizationPicker /> : null}
                <Button
                  size="default"
                  variant="default"
                  className="bg-primary text-primary-foreground shadow-none"
                  onClick={() => navigate(newTemplatePath())}
                >
                  <CirclePlus className="h-5 w-5 lg:mr-2" />
                  <span className="sr-only lg:not-sr-only">
                    {t("EMAIL_SERVICE_TABLE.ADD_TEMPLATE")}
                  </span>
                </Button>
              </div>
            ) : null}
          </div>
          <TabsContent value="Emailstemplates">
            <Card className="rounded shadow-none">
              <CardContent className="mb-4">
                {isConfigsLoading || isLanguageListLoading ? (
                  <Skeleton className="h-12 w-full rounded" />
                ) : (
                  <TemplateFilterToolbar
                    emailConfigsData={Array.isArray(emailConfigsData) ? emailConfigsData : []}
                    languageListData={Array.isArray(languageListData) ? languageListData : []}
                  />
                )}
              </CardContent>
              <CardContent>
                {!isLoading && !isError && data ? (
                  <div className="mb-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-low-emphasis">
                      {countLabel}
                    </p>
                    {showFallbackHint ? (
                      <p className="text-sm text-low-emphasis">
                        {t("EMAIL_SERVICE_TABLE.ORGANIZATION_FALLBACK_HINT", {
                          organization: organizationName,
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <ScrollArea className="w-full">
                  {isLoading || isConfigsLoading || organization.isLoading ? (
                    <LoadingSkelton />
                  ) : isError ? (
                    <div role="alert" className="flex flex-col items-center gap-3 py-10">
                      <p className="text-sm text-high-emphasis">
                        {t("EMAIL_SERVICE_TABLE.TEMPLATES_LOAD_FAILED")}
                      </p>
                      <Button variant="outline" onClick={() => void refetch()}>
                        {t("EMAIL_SERVICE_TABLE.RETRY")}
                      </Button>
                    </div>
                  ) : isEmpty ? (
                    <div className="flex flex-col items-center gap-3 py-10">
                      <p className="text-sm text-high-emphasis">
                        {t("EMAIL_SERVICE_TABLE.ORGANIZATION_EMPTY", {
                          organization: organizationName,
                        })}
                      </p>
                      <Button onClick={() => navigate(newTemplatePath())}>
                        <CirclePlus className="mr-2 h-5 w-5" />
                        {t("EMAIL_SERVICE_TABLE.ADD_TEMPLATE")}
                      </Button>
                    </div>
                  ) : (
                    <EmailTemplateList
                      templates={tableData}
                      isLoading={isLoading}
                      emailConfigsData={Array.isArray(emailConfigsData) ? emailConfigsData : []}
                      languages={Array.isArray(languageListData) ? languageListData : []}
                      organizationName={organizationName}
                      isMultiOrgEnabled={organization.isMultiOrgEnabled}
                      onRowClick={handleRowClick}
                    />
                  )}
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
              {!isLoading && !isError && totalCount > 0 && (
                <div className="mt-5 flex flex-col items-start gap-2 px-6 pb-4 md:flex-row md:items-center md:justify-end md:gap-6">
                  <p className="text-sm text-medium-emphasis">
                    {t("EMAIL_SERVICE_TABLE.PAGE_RANGE", {
                      from: pageFrom,
                      to: pageTo,
                      total: totalCount,
                    })}
                  </p>
                  <Pagination
                    page={pageNumber}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onChange={onPageChangeHandler}
                    onPageSizeChange={onPageSizeChangeHandler}
                  />
                </div>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="Inbox">
            <Card className="rounded shadow-none">
              <CardContent>
                <EmailUsageList isInbound />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="Outgoingmails">
            <Card className="rounded shadow-none">
              <CardContent>
                <EmailUsageList isInbound={false} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
