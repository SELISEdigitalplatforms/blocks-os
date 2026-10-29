import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { userService } from "@blocks-idp/iam/services/user.service";
import type { IRole } from "@blocks-idp/iam/models/role";
import type { User } from "@blocks-idp/iam/models/user";

/**
 * Option sources for the access-policy principal selectors.
 *
 * Two rules drive every design choice here, both because this feeds an ACCESS-POLICY editor:
 *
 * 1. `projectKey` is part of every query key. Keying the React child on the tenant is not enough:
 *    the QueryClient cache is shared, so a key without the tenant would let tenant B be served
 *    tenant A's cached page, and let an administrator pick a principal from the wrong tenant.
 * 2. A stored value is only ever called "unavailable" after a TARGETED lookup came back without
 *    it. Absence from a browse page proves nothing, and a failed lookup is "unresolved", never
 *    "unavailable" - mislabelling a live principal is as damaging as losing one.
 */

export const PRINCIPAL_PAGE_SIZE = 20;

export type PrincipalEntity = "role" | "user";
export type UserPrincipalValue = "itemId" | "email";

export interface PrincipalOption {
  /** The value persisted into the policy: role slug, or user itemId. */
  value: string;
  primaryLabel: string;
  secondaryLabel: string;
}

/** Resolution state of a value already stored on the rule. */
export type StoredValueState =
  | { status: "resolving" }
  | { status: "resolved"; option: PrincipalOption }
  | { status: "unavailable" }
  | { status: "forbidden" }
  | { status: "unresolved" };

export const roleToOption = (role: IRole): PrincipalOption => ({
  value: role.slug,
  primaryLabel: role.name,
  secondaryLabel: role.slug,
});

export const userToOption = (
  user: User,
  valueField: UserPrincipalValue = "itemId",
): PrincipalOption => {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return {
    value: valueField === "email" ? user.email : user.itemId,
    primaryLabel: fullName || user.userName || user.email,
    secondaryLabel: user.email,
  };
};

/**
 * Read the HTTP status structurally rather than via `instanceof HttpError`.
 *
 * Importing `@/lib/http-client` here would be a mistake: that module constructs HttpClient
 * instances at import time, so pulling it into this hook drags the whole genesis-os graph into
 * every test that renders the rule form. Rejections from the shared client carry `.status`
 * (see `app/lib/http-client.ts`), which is all this needs.
 */
const statusOf = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;

export const isAuthError = (error: unknown): boolean => {
  const status = statusOf(error);
  return status === 401 || status === 403;
};

const isNotFound = (error: unknown): boolean => statusOf(error) === 404;

/**
 * Dedupe by stored value, preserving first-seen order.
 *
 * Deliberately separate from pagination termination: a page that repeats an item would hold the
 * unique count below totalCount forever, so termination counts RAW records (see nextPageParam)
 * while only the display de-duplicates.
 */
export const dedupeOptions = (options: PrincipalOption[]): PrincipalOption[] => {
  const seen = new Set<string>();
  const out: PrincipalOption[] = [];
  for (const option of options) {
    if (option.value && !seen.has(option.value)) {
      seen.add(option.value);
      out.push(option);
    }
  }
  return out;
};

interface PrincipalPage {
  options: PrincipalOption[];
  /** Raw record count in this page, before de-duplication. */
  rawCount: number;
  totalCount: number;
}

export const nextPageParam = (
  lastPage: PrincipalPage,
  allPages: PrincipalPage[],
): number | undefined => {
  // A short or empty page is the end, whatever totalCount claims.
  if (lastPage.rawCount === 0 || lastPage.rawCount < PRINCIPAL_PAGE_SIZE) {
    return undefined;
  }
  const fetched = allPages.reduce((sum, page) => sum + page.rawCount, 0);
  if (fetched >= lastPage.totalCount) return undefined;
  return allPages.length; // pages are 0-based in this repo
};

/**
 * Browseable, searchable options for one tenant.
 *
 * `page` is 0-based: every hardcoded caller of useGetRoles/useGetUsers in this client passes
 * `page: 0`, and the users list defaults to `parseAsInteger.withDefault(0)`. The spec's "positive
 * integer" wording would silently skip the first page.
 */
export const usePrincipalOptions = ({
  entity,
  projectKey,
  search,
  enabled,
  userValueField = "itemId",
}: {
  entity: PrincipalEntity;
  projectKey: string;
  search: string;
  enabled: boolean;
  userValueField?: UserPrincipalValue;
}) => {
  const normalizedSearch = search.trim();

  const query = useInfiniteQuery({
    queryKey: ["principal-options", entity, userValueField, projectKey, normalizedSearch],
    enabled: enabled && Boolean(projectKey),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    queryFn: async ({ pageParam }): Promise<PrincipalPage> => {
      if (entity === "role") {
        const response = await roleService.getRoles({
          projectKey,
          page: pageParam,
          pageSize: PRINCIPAL_PAGE_SIZE,
          filter: { search: normalizedSearch },
        });
        const data = response?.data ?? [];
        return {
          options: data.map(roleToOption),
          rawCount: data.length,
          totalCount: response?.totalCount ?? 0,
        };
      }
      const response = await userService.getUsers({
        projectKey,
        page: pageParam,
        pageSize: PRINCIPAL_PAGE_SIZE,
        filter: { name: normalizedSearch, email: normalizedSearch },
      });
      const data = response?.data ?? [];
      return {
          options: data.map((user) => userToOption(user, userValueField)),
        rawCount: data.length,
        totalCount: response?.totalCount ?? 0,
      };
    },
  });

  const options = dedupeOptions(
    (query.data?.pages ?? []).flatMap((page) => page.options),
  );

  return {
    options,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    isForbidden: isAuthError(query.error),
    refetch: query.refetch,
  };
};

/**
 * Resolve values ALREADY stored on the rule, so they can be labelled - or marked Unavailable.
 *
 * Not gated on the popover being open: a closed selector still has to show what is selected and
 * whether it still exists.
 */
export const useStoredPrincipals = ({
  entity,
  projectKey,
  values,
  userValueField = "itemId",
}: {
  entity: PrincipalEntity;
  projectKey: string;
  values: string[];
  userValueField?: UserPrincipalValue;
}) => {
  const wanted = Array.from(new Set(values.filter(Boolean)));

  const query = useQuery({
    queryKey: ["principal-stored", entity, userValueField, projectKey, [...wanted].sort((a, b) => a.localeCompare(b))],
    enabled: Boolean(projectKey) && wanted.length > 0,
    queryFn: async (): Promise<Record<string, StoredValueState>> => {
      const states: Record<string, StoredValueState> = {};

      if (entity === "role") {
        // Exact-slug lookup, paged until exhausted: absence is only provable once every page of
        // the filtered result has been seen.
        const found = new Map<string, PrincipalOption>();
        let page = 0;
        for (;;) {
          const response = await roleService.getRoles({
            projectKey,
            page,
            pageSize: PRINCIPAL_PAGE_SIZE,
            filter: { slugs: wanted },
          });
          const data = response?.data ?? [];
          for (const role of data) found.set(role.slug, roleToOption(role));
          const fetched = (page + 1) * PRINCIPAL_PAGE_SIZE;
          if (
            data.length === 0 ||
            data.length < PRINCIPAL_PAGE_SIZE ||
            fetched >= (response?.totalCount ?? 0)
          ) {
            break;
          }
          page += 1;
        }
        for (const value of wanted) {
          const option = found.get(value);
          states[value] = option
            ? { status: "resolved", option }
            : { status: "unavailable" };
        }
        return states;
      }

      if (userValueField === "email") {
        await Promise.all(
          wanted.map(async (value) => {
            const response = await userService.getUsers({
              projectKey,
              page: 0,
              pageSize: PRINCIPAL_PAGE_SIZE,
              filter: { name: "", email: value },
            });
            const user = (response?.data ?? []).find(
              (candidate) => candidate.email.toLowerCase() === value.toLowerCase(),
            );
            states[value] = user
              ? { status: "resolved", option: userToOption(user, "email") }
              : { status: "unavailable" };
          }),
        );
        return states;
      }

      // Users have no id filter on the list query, so each stored id is resolved individually.
      await Promise.all(
        wanted.map(async (value) => {
          try {
            const response = await userService.getUserById({
              id: value,
              projectKey,
            });
            const user = response?.data;
            // The returned user must be THE requested one. Anything else is "unresolved", never
            // "resolved" (which would label a stored id with someone else's name) and never
            // "unavailable" (which would claim a live principal was deleted). Only an actually
            // absent user is unavailable.
            if (user == null) {
              states[value] = { status: "unavailable" };
            } else if (user.itemId === value) {
              states[value] = { status: "resolved", option: userToOption(user) };
            } else {
              states[value] = { status: "unresolved" };
            }
          } catch (error) {
            if (isNotFound(error)) {
              states[value] = { status: "unavailable" };
            } else if (isAuthError(error)) {
              states[value] = { status: "forbidden" };
            } else {
              // Network/5xx: we do not know it is gone. Never label it Unavailable.
              states[value] = { status: "unresolved" };
            }
          }
        }),
      );
      return states;
    },
  });

  const stateFor = (value: string): StoredValueState => {
    if (!projectKey) return { status: "unresolved" };
    if (query.isLoading) return { status: "resolving" };
    if (query.error) {
      return isAuthError(query.error)
        ? { status: "forbidden" }
        : { status: "unresolved" };
    }
    return query.data?.[value] ?? { status: "resolving" };
  };

  return { stateFor, isLoading: query.isLoading, refetch: query.refetch };
};

