import { FilterToolbar } from "@/components/filter-toolbar";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import {
  SECRET_STATUS,
  SECRET_STATUS_LABEL,
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
};

const TYPE_OPTIONS = [
  { value: SECRET_TYPE.Api, label: SECRET_TYPE_LABEL.api },
  { value: SECRET_TYPE.Service, label: SECRET_TYPE_LABEL.service },
];

const STATUS_OPTIONS = [
  { value: SECRET_STATUS.Active, label: SECRET_STATUS_LABEL.active },
  { value: SECRET_STATUS.Locked, label: SECRET_STATUS_LABEL.locked },
  { value: SECRET_STATUS.Deleted, label: SECRET_STATUS_LABEL.deleted },
];

export const SECRET_FILTER_DEFAULTS: SecretFilterValues = { search: "", type: "", status: "" };

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
    secretPage: parseAsInteger.withDefault(0),
    secretPageSize: parseAsInteger.withDefault(10),
  });

  const values: SecretFilterValues = {
    search: queryParams.secretSearch,
    type: queryParams.secretType,
    status: queryParams.secretStatus,
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

  const resetHandler = () =>
    setQueryParams((params) => ({
      ...params,
      secretSearch: "",
      secretType: "",
      secretStatus: "",
      secretPage: 0,
    }));

  return (
    <FilterToolbar<SecretFilterValues>
      filters={[
        {
          key: "search",
          type: "SearchInput",
          label: "",
          props: { placeholder: "Search by name, description or secret ID" },
        },
        { key: "type", type: "Radio", label: "Type", props: { options: TYPE_OPTIONS } },
        { key: "status", type: "Radio", label: "Status", props: { options: STATUS_OPTIONS } },
      ]}
      values={values}
      defaultValues={SECRET_FILTER_DEFAULTS}
      onChange={(key, value) => changeHandler(key as keyof SecretFilterValues, value)}
      onReset={resetHandler}
    />
  );
}
