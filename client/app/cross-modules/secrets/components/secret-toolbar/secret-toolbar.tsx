import { Archive, Info, KeyRound } from "lucide-react";
import { FilterToolbar } from "@/components/filter-toolbar";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  underlineTabTriggerClass,
  underlineTabsListClass,
} from "@/components/ui-kits/tabs/tabs";
import { cn } from "@/lib/utils";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import {
  useSecretTags,
  useSecretViewCounts,
} from "@/cross-modules/secrets/hooks/use-secret-management";
import {
  SECRET_STATUS,
  SECRET_STATUS_LABEL,
  SECRET_TAG_MAX_PER_FILTER,
  SECRET_TYPE,
  SECRET_TYPE_LABEL,
  type SecretFilter,
  type SecretStatus,
  type SecretType,
} from "@/cross-modules/secrets/models/secret.model";

type SecretFilterValues = {
  search: string;
  type: string;
  status: string;
  tags: string[];
};

const TYPE_OPTIONS = [
  { value: SECRET_TYPE.Api, label: SECRET_TYPE_LABEL.api },
  { value: SECRET_TYPE.Service, label: SECRET_TYPE_LABEL.service },
  { value: SECRET_TYPE.Both, label: SECRET_TYPE_LABEL.both },
];

// Archived is its own tab, not a status option: it is where restore and purge live, and a
// radio buried in the filter popover is not somewhere anyone would look for it.
const STATUS_OPTIONS = [
  { value: SECRET_STATUS.Active, label: SECRET_STATUS_LABEL.active },
  { value: SECRET_STATUS.Locked, label: SECRET_STATUS_LABEL.locked },
];

export const SECRET_VIEW = { Secrets: "secrets", Archived: "archived" } as const;
export type SecretView = (typeof SECRET_VIEW)[keyof typeof SECRET_VIEW];

/** Count pill on a tab. Absent until the total has loaded, so it never flashes a wrong 0. */
const TabCount = ({ value, active }: { value?: number; active: boolean }) =>
  value === undefined ? null : (
    <span
      className={cn(
        "min-w-5 rounded-full px-1.5 py-px text-center text-xs font-medium tabular-nums",
        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );

export const SECRET_FILTER_DEFAULTS: SecretFilterValues = {
  search: "",
  type: "",
  status: "",
  tags: [],
};

/**
 * Filters live in the URL so a reload, a shared link and the browser back button all land on
 * the same view. Keys are prefixed because the secret-management layout mounts several
 * sibling pages that each keep their own query state.
 */
export const useSecretFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    secretSearch: parseAsString.withDefault(""),
    secretType: parseAsString.withDefault(""),
    secretStatus: parseAsString.withDefault(""),
    secretTags: parseAsArrayOf(parseAsString).withDefault([]),
    secretPage: parseAsInteger.withDefault(0),
    secretPageSize: parseAsInteger.withDefault(10),
  });

  const values: SecretFilterValues = {
    search: queryParams.secretSearch,
    type: queryParams.secretType,
    status: queryParams.secretStatus,
    tags: queryParams.secretTags ?? [],
  };

  /**
   * Request filter for the list endpoint. Empty strings are dropped rather than sent — the
   * backend's `Type`/`Status` are nullable and a blank value is not the same as "no filter".
   * `pageNumber` is 1-based on the wire while the pagination control is 0-based.
   */
  const filter: SecretFilter = {
    ...(values.search ? { search: values.search } : {}),
    ...(values.type ? { type: values.type as SecretType } : {}),
    ...(values.status ? { status: values.status as SecretStatus } : {}),
    // Any-of on the server, so a second chip widens the result. Trimmed to the server cap
    // rather than sent over it, which would 400 the whole list instead of just ignoring the
    // extra chips.
    ...(values.tags.length ? { tags: values.tags.slice(0, SECRET_TAG_MAX_PER_FILTER) } : {}),
    // Deleted secrets are excluded server-side unless asked for, so the only view that opts in
    // is the one explicitly filtering for them.
    ...(values.status === SECRET_STATUS.Deleted ? { includeDeleted: true } : {}),
    pageNumber: queryParams.secretPage + 1,
    pageSize: queryParams.secretPageSize,
  };

  // The Archived tab is the `deleted` status filter; there is no separate URL key to drift.
  const view: SecretView =
    values.status === SECRET_STATUS.Deleted ? SECRET_VIEW.Archived : SECRET_VIEW.Secrets;

  const setPage = (page: number) => setQueryParams((params) => ({ ...params, secretPage: page }));

  const setPageSize = (pageSize: number) =>
    setQueryParams((params) => ({ ...params, secretPageSize: pageSize, secretPage: 0 }));

  return { queryParams, setQueryParams, values, filter, view, setPage, setPageSize };
};

export function SecretToolbar() {
  const { setQueryParams, values, view } = useSecretFilterQueryParams();
  const counts = useSecretViewCounts();
  const isArchived = view === SECRET_VIEW.Archived;
  const viewStatus = isArchived ? SECRET_STATUS.Deleted : "";
  // The toolbar freezes its defaults on first render, so the `deleted` status cannot be taught
  // to it as a per-tab default. It is the tab, not a filter: hide it from the toolbar instead.
  const toolbarValues = isArchived ? { ...values, status: "" } : values;
  const { data: tagCatalogue = [], isLoading: isTagsLoading } = useSecretTags();

  // The catalogue is the whole option list: the server adds any tag someone invents to it, so
  // a tag that exists on a secret is a tag that can be filtered on.
  const tagOptions = tagCatalogue.map((tag) => ({ value: tag.key, label: tag.label }));

  // Radio clears to null; normalise to "" so it round-trips through the URL as "no filter".
  const changeHandler = (key: keyof SecretFilterValues, value: unknown) => {
    const next = typeof value === "string" ? value : "";
    // The status control is not rendered on the Archived tab; never let it leave that view.
    if (key === "status" && isArchived) return;
    setQueryParams((params) => ({
      ...params,
      ...(key === "search" ? { secretSearch: next } : {}),
      ...(key === "type" ? { secretType: next } : {}),
      ...(key === "status" ? { secretStatus: next } : {}),
      // Any filter change can shrink the result set below the current page.
      secretPage: 0,
    }));
  };

  // MultiSelect hands back an array, so it cannot share the string-normalising handler above.
  const tagsChangeHandler = (selected: string[]) =>
    setQueryParams((params) => ({
      ...params,
      // Cleared to empty means "no filter", and nuqs drops an empty array from the URL.
      secretTags: selected.length ? selected : null,
      secretPage: 0,
    }));

  const resetHandler = () =>
    setQueryParams((params) => ({
      ...params,
      secretSearch: "",
      secretType: "",
      // Reset clears the filters, not the tab you are on.
      secretStatus: viewStatus,
      secretTags: null,
      secretPage: 0,
    }));

  // Switching tabs drops the status filter (Active/Locked mean nothing among archived secrets)
  // and returns to the first page; search, type and tags carry over.
  const viewChangeHandler = (next: string) => {
    // Re-picking the current tab is not a change; it would otherwise throw away the page.
    if (next === view) return;
    setQueryParams((params) => ({
      ...params,
      secretStatus: next === SECRET_VIEW.Archived ? SECRET_STATUS.Deleted : "",
      secretPage: 0,
    }));
  };

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={viewChangeHandler}>
        <TabsList aria-label="Secret views" className={underlineTabsListClass}>
          <TabsTrigger
            value={SECRET_VIEW.Secrets}
            className={cn(underlineTabTriggerClass, "gap-2")}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            <span>Secrets</span>
            <TabCount value={counts.secrets} active={!isArchived} />
          </TabsTrigger>
          <TabsTrigger
            value={SECRET_VIEW.Archived}
            className={cn(underlineTabTriggerClass, "gap-2")}
          >
            <Archive className="h-4 w-4" aria-hidden />
            <span>Archived</span>
            <TabCount value={counts.archived} active={isArchived} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isArchived && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Archived secrets no longer work. Restore one to use it again, or purge it to delete
            it and its value permanently.
          </span>
        </p>
      )}

      <FilterToolbar<SecretFilterValues>
        filters={[
          {
            key: "search",
            type: "SearchInput",
            label: "",
            // The control defaults to w-52, which clips a placeholder this long. The backend also
            // matches description, but naming every matched field is what made it overflow.
            props: {
              placeholder: "Search by name or ID",
              className: "w-full sm:w-72",
            },
          },
          { key: "type", type: "Radio", label: "Type", props: { options: TYPE_OPTIONS } },
          ...(isArchived
            ? []
            : [
                {
                  key: "status" as const,
                  type: "Radio" as const,
                  label: "Status",
                  props: { options: STATUS_OPTIONS },
                },
              ]),
          {
            key: "tags",
            type: "MultiSelect",
            label: "Tags",
            props: { options: tagOptions, disabled: isTagsLoading },
          },
        ]}
        values={toolbarValues}
        defaultValues={SECRET_FILTER_DEFAULTS}
        onChange={(key, value) =>
          key === "tags"
            ? tagsChangeHandler(value as string[])
            : changeHandler(key as keyof SecretFilterValues, value)
        }
        onReset={resetHandler}
      />
    </div>
  );
}
