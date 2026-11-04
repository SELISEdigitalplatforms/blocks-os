import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { FilterControls } from "@/components/filter-toolbar";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { debounce } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import type {
  IAssignTemplatesRequest,
  IEmailConfig,
  IEmailTemplate,
} from "@blocks-communication/mail/models/email";
import {
  useAssignTemplates,
  useGetEmailTemplates,
} from "@blocks-communication/mail/hooks/use-email-template";
import {
  DEFAULT_ORGANIZATION_ID,
  organizationOf,
} from "@blocks-communication/mail/constants/organization";
import { languageNameOf } from "@blocks-communication/mail/constants/template-organization";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import { TemplateConfigurationName } from "@blocks-communication/mail/email/email-service-table/template-configuration-name";

const MAX_TEMPLATE_IDS = 500;
const PAGE_SIZE = 10;

interface AssignTemplatesDialogProps {
  /** The outbound configuration the chosen templates switch to. */
  config: IEmailConfig;
  /** The configurations the page loaded, for the "Current configuration" names. */
  configs: IEmailConfig[];
  /** The configuration's organization, as the page names it. */
  organizationName: string;
  /** Multi-org projects say whose templates are listed; single-org ones list them all (H11). */
  showOrganization: boolean;
  onClose: () => void;
}

/**
 * The texts that name the organization: an organization's, the Default organization's, or none
 * with multi-org off. Each picks the matching key variant.
 */
const variantOf = (showOrganization: boolean, isDefaultOrganization: boolean) => {
  if (!showOrganization) return "";
  return isDefaultOrganization ? "_DEFAULT" : "_ORGANIZATION";
};

/**
 * SPEC32 §4 AssignTemplates design: pick templates of the configuration's organization, on this
 * page or on every page, and point them at the configuration in one request.
 */
export function AssignTemplatesDialog({
  config,
  configs,
  organizationName,
  showOrganization,
  onClose,
}: Readonly<AssignTemplatesDialogProps>) {
  const { t } = useT("os.communication.mail");
  const organizationId = organizationOf(config);
  const variant = variantOf(showOrganization, organizationId === DEFAULT_ORGANIZATION_ID);
  const textValues = { config: config.name, organization: organizationName };

  // Filters live in the dialog, not in the Templates page's URL (D5).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [allPages, setAllPages] = useState(false);

  const applyFilter = (change: () => void) => {
    change();
    setPage(0);
    // "Every page" means every template matching these filters; new filters need a new choice.
    setAllPages(false);
  };
  const applySearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
        setPage(0);
        setAllPages(false);
      }, 300),
    [],
  );
  useEffect(() => () => applySearch.cancel(), [applySearch]);

  const list = useGetEmailTemplates(
    page,
    PAGE_SIZE,
    search,
    "Name",
    false,
    language,
    "",
    organizationId,
  );
  // How many of the matching templates already use the configuration (D4).
  const already = useGetEmailTemplates(
    0,
    1,
    search,
    "Name",
    false,
    language,
    config.itemId,
    organizationId,
  );
  const { data: languages } = useGetLanguages();
  const { mutateAsync: assignTemplates, isPending } = useAssignTemplates();

  const rows: IEmailTemplate[] = list.data?.templates ?? [];
  const totalCount = list.data?.totalCount ?? 0;
  const totalSelectable = Math.max(0, totalCount - (already.data?.totalCount ?? 0));
  const isAlready = (template: IEmailTemplate) => template.mailConfigurationId === config.itemId;
  const selectableOnPage = rows.filter((template) => !isAlready(template));
  const pageChecked =
    allPages ||
    (selectableOnPage.length > 0 && selectableOnPage.every((row) => picked.has(row.itemId)));
  const selectedCount = allPages ? totalSelectable : picked.size;
  // The server takes at most this many explicit ids per request (C4); every-page mode has no limit.
  const tooMany = !allPages && picked.size > MAX_TEMPLATE_IDS;
  // A search still being typed would not be in the request yet (the box waits before it applies).
  const searchPending = searchInput !== search;
  const projectLanguages = [
    ...new Map((languages ?? []).map((item) => [item.languageCode, item])).values(),
  ];

  const toggleRow = (itemId: string) => {
    if (allPages) {
      // Every row shows ticked in every-page mode; unticking one keeps the rest of this page
      // ticked and leaves every-page mode, instead of adding the row the user meant to untick.
      setAllPages(false);
      setPicked(new Set(selectableOnPage.map((row) => row.itemId).filter((id) => id !== itemId)));
      return;
    }
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };
  const togglePage = () => {
    const wasChecked = pageChecked;
    setAllPages(false);
    setPicked((current) => {
      const next = new Set(current);
      for (const row of selectableOnPage) {
        if (wasChecked) next.delete(row.itemId);
        else next.add(row.itemId);
      }
      return next;
    });
  };
  const clearSelection = () => {
    setAllPages(false);
    setPicked(new Set());
  };

  const showFailure = (errors: unknown) =>
    showErrorToast({ errors, customMessages: templateErrorMessages(t) });

  const onAssign = async () => {
    const request: IAssignTemplatesRequest = allPages
      ? {
          configurationId: config.itemId,
          allMatching: true,
          ...(search ? { searchKey: search } : {}),
          ...(language ? { language } : {}),
        }
      : { configurationId: config.itemId, allMatching: false, templateIds: [...picked] };
    try {
      const res = await assignTemplates(request);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("ASSIGN_TEMPLATES.SUCCESS", {
            count: res.updatedCount ?? 0,
            config: config.name,
          }),
        });
        onClose();
        return;
      }
      // The dialog and its selection stay, so the admin can adjust and retry (C7).
      showFailure(res?.errors);
    } catch (error) {
      showFailure(isErrorWithErrors(error) ? error.errors : undefined);
    }
  };

  const pageFrom = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageTo = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  const renderRows = () => {
    if (list.isLoading) {
      return Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={5}>
            <Skeleton className="h-6 w-full rounded" />
          </TableCell>
        </TableRow>
      ));
    }
    if (list.isError) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center">
            <div className="flex flex-col items-center gap-2 py-6">
              <span>{t("EMAIL_SERVICE_TABLE.TEMPLATES_LOAD_FAILED")}</span>
              <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
                {t("EMAIL_SERVICE_TABLE.RETRY")}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
            {search || language
              ? t("EMAIL_TEMPLATE_LIST.NO_TEMPLATES")
              : t(`ASSIGN_TEMPLATES.EMPTY${variant}`, textValues)}
          </TableCell>
        </TableRow>
      );
    }
    return rows.map((template) => {
      const disabled = isAlready(template);
      const checked = !disabled && (allPages || picked.has(template.itemId));
      const languageName = languageNameOf(template.language, projectLanguages);
      let outcome = t("ASSIGN_TEMPLATES.NO_CHANGE");
      if (disabled) outcome = t("ASSIGN_TEMPLATES.ALREADY_USES", { config: config.name });
      return (
        <TableRow key={template.itemId}>
          <TableCell className="w-11">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={() => toggleRow(template.itemId)}
              aria-label={t("ASSIGN_TEMPLATES.ROW_LABEL", {
                name: template.name ?? "",
                language: languageName,
              })}
            />
          </TableCell>
          <TableCell className="font-medium">{template.name}</TableCell>
          <TableCell>{languageName}</TableCell>
          <TableCell>
            <TemplateConfigurationName template={template} configs={configs} />
          </TableCell>
          <TableCell>
            {checked ? (
              <span className="inline-flex items-center gap-2">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                {t("ASSIGN_TEMPLATES.SWITCHES_TO", { config: config.name })}
              </span>
            ) : (
              <span className="text-muted-foreground">{outcome}</span>
            )}
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <DialogContent className="w-[min(1000px,calc(100%-32px))] max-w-none rounded-md sm:max-w-none">
      <DialogHeader>
        <DialogTitle className="text-left">{t("ASSIGN_TEMPLATES.TITLE")}</DialogTitle>
        <DialogDescription className="text-left">
          {t(`ASSIGN_TEMPLATES.DESCRIPTION${variant}`, textValues)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          className="h-10 w-full max-w-sm"
          aria-label={t("ASSIGN_TEMPLATES.SEARCH_LABEL")}
          placeholder={t("ASSIGN_TEMPLATES.SEARCH_PLACEHOLDER")}
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            applySearch(event.target.value);
          }}
        />
        <FilterControls.Radio
          label={t("TEMPLATE_FILTER_TOOLBAR.LANGUAGE")}
          value={language}
          options={projectLanguages.map((item) => ({
            label: item.languageName,
            value: item.languageCode,
          }))}
          onChange={(value) => applyFilter(() => setLanguage(String(value ?? "")))}
        />
      </div>

      {pageChecked && !allPages && already.isSuccess && totalSelectable > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-center gap-2 rounded-md bg-blocks-primary-shades-300 px-4 py-2 text-sm"
        >
          <span>{t("ASSIGN_TEMPLATES.PAGE_SELECTED", { count: selectableOnPage.length })}</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAllPages(true)}>
            {t(`ASSIGN_TEMPLATES.SELECT_ALL${variant}`, { ...textValues, count: totalSelectable })}
          </Button>
        </div>
      ) : null}
      {allPages ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-center gap-2 rounded-md bg-blocks-primary-shades-300 px-4 py-2 text-sm"
        >
          <span>
            {t(`ASSIGN_TEMPLATES.ALL_SELECTED${variant}`, {
              ...textValues,
              count: totalSelectable,
            })}
          </span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={clearSelection}>
            {t("ASSIGN_TEMPLATES.CLEAR_SELECTION")}
          </Button>
        </div>
      ) : null}

      <div className="rounded-md border">
        <div className="max-h-[520px] overflow-auto">
          <Table wrapperClassName="overflow-visible" className="min-w-[760px]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-11">
                  <Checkbox
                    checked={pageChecked}
                    disabled={selectableOnPage.length === 0}
                    onCheckedChange={togglePage}
                    aria-label={t("ASSIGN_TEMPLATES.SELECT_PAGE")}
                  />
                </TableHead>
                <TableHead>{t("common:NAME")}</TableHead>
                <TableHead>{t("EMAIL_TEMPLATE_LIST.COLUMN_LANGUAGE")}</TableHead>
                <TableHead>{t("ASSIGN_TEMPLATES.COLUMN_CURRENT_CONFIGURATION")}</TableHead>
                <TableHead>{t("ASSIGN_TEMPLATES.COLUMN_WHAT_HAPPENS")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows()}</TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {t("EMAIL_SERVICE_TABLE.PAGE_RANGE", { from: pageFrom, to: pageTo, total: totalCount })}
          </span>
          {totalCount > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onChange={setPage}
              compact
            />
          ) : null}
        </div>
      </div>

      <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {tooMany ? (
          <p role="alert" className="text-sm text-destructive">
            {t("TEMPLATE_ERRORS.ASSIGN_TOO_MANY")}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          <strong className="text-high-emphasis">
            {t("ASSIGN_TEMPLATES.SELECTED", { count: selectedCount })}
          </strong>{" "}
          {selectedCount > 0
            ? t(`ASSIGN_TEMPLATES.SUMMARY${variant}`, { ...textValues, count: selectedCount })
            : null}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            {t("common:CANCEL")}
          </Button>
          <Button
            disabled={selectedCount === 0 || isPending || tooMany || searchPending}
            onClick={() => void onAssign()}
          >
            {t("ASSIGN_TEMPLATES.SUBMIT", { count: selectedCount })}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
