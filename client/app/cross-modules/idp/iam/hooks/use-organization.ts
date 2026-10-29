import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  IGetOrganizationByIdParams,
  IOrganization,
  IOrganizationFilter,
  IUpdateOrganizationPayload,
} from "@blocks-idp/iam/models/organization";
import { IOrganizationConfigPayload } from "@blocks-idp/iam/models/organization-config.model";
import { iamService } from "@blocks-idp/iam/services/iam.service";

const DEFAULT_ORGANIZATION_ID = "default";
const DEFAULT_ORGANIZATION_NAME = "Default";
const ORGANIZATION_OPTIONS_PAGE_SIZE = 100;
const ORGANIZATION_FILTER_PAGE_SIZE = 25;

export const useGetOrganizations = (options: IOrganizationFilter) => {
  const { enabled: _enabled, ...queryKeyOptions } = options;
  return useQuery({
    queryKey: ["organizations", queryKeyOptions],
    queryFn: () =>
      iamService.organization.getOrganizations({
        page: options.page,
        pageSize: options.pageSize,
        projectKey: options.projectKey,
        searchText: options.search,
      }),
    placeholderData: keepPreviousData,
    enabled: options.enabled !== undefined ? options.enabled : !!options.projectKey,
  });
};

export const useGetEnabledOrganizationsInfinite = (
  projectKey: string,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useInfiniteQuery({
    queryKey: ["organizations", "enabled-options-infinite", projectKey],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      iamService.organization.getOrganizations({
        projectKey,
        page: pageParam,
        pageSize: ORGANIZATION_FILTER_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce(
        (count, page) => count + (page.organizations?.length ?? 0),
        0,
      );
      const lastPageCount = lastPage.organizations?.length ?? 0;
      return lastPageCount > 0 && loadedCount < (lastPage.totalCount ?? loadedCount)
        ? pages.length
        : undefined;
    },
    enabled: enabled && !!projectKey,
  });

export const getEnabledOrganizationsFromPages = (
  pages: Array<{ organizations?: IOrganization[] }> = [],
) => {
  const enabledOrganizations = pages
    .flatMap((page) => page.organizations ?? [])
    .filter((organization) => organization.isDisabled !== true && organization.isEnable !== false);
  const organizationById = new Map(
    enabledOrganizations.map((organization) => [organization.itemId, organization]),
  );

  if (organizationById.size > 0 && !organizationById.has(DEFAULT_ORGANIZATION_ID)) {
    organizationById.set(DEFAULT_ORGANIZATION_ID, {
      itemId: DEFAULT_ORGANIZATION_ID,
      name: DEFAULT_ORGANIZATION_NAME,
      isEnable: true,
      isDisabled: false,
      createdDate: "",
      lastUpdatedDate: "",
      createdBy: "",
      lastUpdatedBy: "",
      language: null,
      organizationIds: [],
      tags: [],
    });
  }

  return [...organizationById.values()];
};

export const useGetOrganizationById = (params: IGetOrganizationByIdParams) => {
  return useQuery({
    queryKey: ["organization", params.itemId, params.projectKey],
    queryFn: () => iamService.organization.getOrganizationById(params),
    enabled: !!params.itemId && !!params.projectKey,
  });
};

export const useSaveOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["organization", "createOrUpdate"],
    mutationFn: iamService.organization.saveOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["organization", "update"],
    mutationFn: (payload: IUpdateOrganizationPayload) =>
      iamService.organization.updateOrganization(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      if (variables?.itemId) {
        queryClient.invalidateQueries({ queryKey: ["organization", variables.itemId] });
      }
    },
  });
};

export const useGetOrganizationConfig = (projectKey: string) => {
  return useQuery({
    queryKey: ["organization", "config", projectKey],
    queryFn: () => iamService.organization.getOrganizationConfig(projectKey),
    enabled: !!projectKey,
  });
};

export const useGetAllEnabledOrganizations = (
  projectKey: string,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  return useQuery({
    queryKey: ["organizations", "enabled-options", projectKey],
    queryFn: async () => {
      const organizations = [];
      let page = 0;
      let totalCount = 0;

      do {
        const response = await iamService.organization.getOrganizations({
          projectKey,
          page,
          pageSize: ORGANIZATION_OPTIONS_PAGE_SIZE,
        });
        const pageOrganizations = response.organizations ?? [];
        organizations.push(...pageOrganizations);
        totalCount = response.totalCount ?? organizations.length;
        page += 1;
      } while (organizations.length < totalCount);

      return getEnabledOrganizationsFromPages([{ organizations }]);
    },
    enabled: enabled && !!projectKey,
  });
};

export const useSaveOrganizationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["organization", "config", "save"],
    mutationFn: (payload: IOrganizationConfigPayload) =>
      iamService.organization.saveOrganizationConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "config"] });
    },
  });
};
