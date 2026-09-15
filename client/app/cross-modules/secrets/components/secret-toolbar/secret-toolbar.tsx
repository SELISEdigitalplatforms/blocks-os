import { FilterToolbar } from "@/components/filter-toolbar";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useSecretTags } from "@/cross-modules/secrets/hooks/use-secret-management";
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

const STATUS_OPTIONS = [
  { value: SECRET_STATUS.Active, label: SECRET_STATUS_LABEL.active },
  { value: SECRET_STATUS.Locked, label: SECRET_STATUS_LABEL.locked },
  { value: SECRET_STATUS.Deleted, label: SECRET_STATUS_LABEL.deleted },
];

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

  const setPage = (page: number) => setQueryParams((params) => ({ ...params, secretPage: page }));

  const setPageSize = (pageSize: number) =>
    setQueryParams((params) => ({ ...params, secretPageSize: pageSize, secretPage: 0 }));

  return { queryParams, setQueryParams, values, filter, setPage, setPageSize };
};

export function SecretToolbar() {
  const { setQueryParams, values } = useSecretFilterQueryParams();
  const { data: tagCatalogue = [], isLoading: isTagsLoading } = useSecretTags();

  // The catalogue is the whole option list: the server adds any tag someone invents to it, so
  // a tag that exists on a secret is a tag that can be filtered on.
  const tagOptions = tagCatalogue.map((tag) => ({ value: tag.key, label: tag.label }));

  // Radio clears to null; normalise to "" so it round-trips through the URL as "no filter".
  const changeHandler = (key: keyof SecretFilterValues, value: unknown) => {
    const next = typeof value === "string" ? value : "";
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
      secretStatus: "",
      secretTags: null,
      secretPage: 0,
    }));

  return (
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
        { key: "status", type: "Radio", label: "Status", props: { options: STATUS_OPTIONS } },
        {
          key: "tags",
          type: "MultiSelect",
          label: "Tags",
          props: { options: tagOptions, disabled: isTagsLoading },
        },
      ]}
      values={values}
      defaultValues={SECRET_FILTER_DEFAULTS}
      onChange={(key, value) =>
        key === "tags"
          ? tagsChangeHandler(value as string[])
          : changeHandler(key as keyof SecretFilterValues, value)
      }
      onReset={resetHandler}
    />
  );
}
