import { useProjectStore } from "@seliseblocks/genesis-os";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getEnabledOrganizationsFromPages,
  useGetEnabledOrganizationsInfinite,
} from "@blocks-idp/iam/hooks/use-organization";
import { DEFAULT_ORGANIZATION_ID } from "@blocks-communication/mail/constants/organization";
import type { ITemplateOrganizationCopy } from "@blocks-communication/mail/models/email";
import { emailService } from "@blocks-communication/mail/services/email.services";

/** The copies lookup takes at most this many organization ids per call (SPEC33 §6.2). */
const COPIES_LOOKUP_SIZE = 25;

/** Queues the Worker job that copies a Default organization template to organizations (H1). */
export const useCopyTemplateToOrganizations = () =>
  useMutation({
    mutationKey: ["template", "copy-to-organizations"],
    mutationFn: emailService.copyTemplateToOrganizations,
  });

export interface CopyTargetOrganization {
  itemId: string;
  name: string;
}

export interface OrganizationChecklistData {
  /** The enabled organizations loaded so far, Default left out (it owns the template). */
  organizations: CopyTargetOrganization[];
  /** Organizations among the loaded ones that already have their own copy, by organization id. */
  copies: ReadonlyMap<string, ITemplateOrganizationCopy>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  /** A copies lookup for the loaded organizations hasn't answered yet: their state isn't known. */
  copiesLoading: boolean;
  /** A copies lookup failed: some loaded organizations may have a copy the list doesn't show. */
  copiesError: boolean;
  /** Asks the failed copies lookups again. */
  refetchCopies: () => void;
}

/**
 * The organizations a template can be copied to, 25 per page from the project's organizations,
 * and which of the loaded ones already have their own copy (H9). Without a template id (New
 * Template before step 1 has saved it) nothing has a copy to look up (Q4: A).
 */
export const useOrganizationChecklistData = (
  templateId: string | undefined,
): OrganizationChecklistData => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const list = useGetEnabledOrganizationsInfinite(tenantId);
  const pages = list.data?.pages;

  const organizations = useMemo(
    () =>
      getEnabledOrganizationsFromPages(pages)
        .filter((organization) => organization.itemId !== DEFAULT_ORGANIZATION_ID)
        .map((organization) => ({ itemId: organization.itemId, name: organization.name })),
    [pages],
  );

  const groups = useMemo(() => {
    const ids = organizations.map((organization) => organization.itemId);
    const chunks: string[][] = [];
    for (let start = 0; start < ids.length; start += COPIES_LOOKUP_SIZE) {
      chunks.push(ids.slice(start, start + COPIES_LOOKUP_SIZE));
    }
    return chunks;
  }, [organizations]);

  const lookups = useQueries({
    queries: groups.map((ids) => ({
      queryKey: ["template-organization-copies", tenantId, templateId, ids],
      queryFn: () => emailService.getTemplateOrganizationCopies(templateId ?? "", ids),
      enabled: !!templateId,
    })),
  });

  const copies = useMemo(() => {
    const byOrganization = new Map<string, ITemplateOrganizationCopy>();
    for (const lookup of lookups) {
      for (const copy of lookup.data?.copies ?? []) {
        byOrganization.set(copy.organizationId, copy);
      }
    }
    return byOrganization;
  }, [lookups]);

  const copiesLoading = lookups.some((lookup) => lookup.isLoading);
  const copiesError = lookups.some((lookup) => lookup.isError);

  return {
    organizations,
    copies,
    copiesLoading,
    copiesError,
    refetchCopies: () => {
      for (const lookup of lookups) {
        if (lookup.isError) void lookup.refetch();
      }
    },
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: () => void list.refetch(),
    hasNextPage: !!list.hasNextPage,
    fetchNextPage: () => void list.fetchNextPage(),
    isFetchingNextPage: list.isFetchingNextPage,
  };
};
