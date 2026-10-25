import { FormControl, FormDescription, FormItem, FormLabel } from "@/components/ui-kits/form/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useGrantScope } from "@blocks-idp/iam/hooks/use-grant-scope";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useMemo } from "react";

/** Radix Select forbids an empty item value, so "no parent" travels as this marker. */
const NO_PARENT = "__none__";
const OPTIONS_PAGE_SIZE = 200;

type ManagedBySelectProps = {
  /** Slug of the chosen role, or "" / null for none. */
  value: string | null | undefined;
  onChange: (slug: string) => void;
  /** A role cannot be managed by itself. */
  excludeSlug?: string;
  disabled?: boolean;
};

/**
 * "Managed by": the role above this one. A limited caller may only pick a role they hold or
 * manage; the system user may pick any role. Hidden until the grant scope has loaded.
 */
export const ManagedBySelect = ({
  value,
  onChange,
  excludeSlug,
  disabled,
}: Readonly<ManagedBySelectProps>) => {
  const { scope, isRestricted, managedByCandidates } = useGrantScope();
  const isSystemUser = scope?.isSystemUser === true;
  const restrictedCandidates = useMemo(
    () => managedByCandidates.filter((slug) => slug !== excludeSlug),
    [managedByCandidates, excludeSlug],
  );
  const { data } = useGetRoles(
    {
      page: 0,
      pageSize: OPTIONS_PAGE_SIZE,
      projectKey: "managed-by",
      sort: { property: "Name", isDescending: false },
      // The system user is not limited, so every role of the organization is a candidate.
      filter: isSystemUser ? { search: "" } : { slugs: restrictedCandidates },
    },
    { enabled: isSystemUser || restrictedCandidates.length > 0 },
  );

  if (!isRestricted && !isSystemUser) return null;

  const roles = data?.data ?? [];
  const nameBySlug = new Map(roles.map((role) => [role.slug, role.name]));
  // A role cannot hang below itself or below a role under it: the server refuses that loop.
  const candidates = isSystemUser
    ? roles
        .filter((role) => role.slug !== excludeSlug && !(excludeSlug && role.ancestorRoleSlugs?.includes(excludeSlug)))
        .map((role) => role.slug)
    : restrictedCandidates;
  const current = value ?? "";
  // A parent set earlier by someone else must still show, even if this caller could not pick it.
  const options = current && !candidates.includes(current) ? [...candidates, current] : candidates;

  return (
    <FormItem>
      <FormLabel>Managed by</FormLabel>
      <Select
        value={current || NO_PARENT}
        onValueChange={(next) => onChange(next === NO_PARENT ? "" : next)}
        disabled={disabled}
      >
        <FormControl>
          <SelectTrigger data-testid="managed-by-select">
            <SelectValue placeholder="No one" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value={NO_PARENT}>No one</SelectItem>
          {options.map((slug) => (
            <SelectItem key={slug} value={slug}>
              {nameBySlug.get(slug) ?? slug}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormDescription>Holders of this role can manage the new role.</FormDescription>
    </FormItem>
  );
};
