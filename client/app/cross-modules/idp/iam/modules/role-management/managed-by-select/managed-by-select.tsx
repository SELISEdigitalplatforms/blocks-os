import { FormControl, FormDescription, FormItem, FormLabel } from "@/components/ui-kits/form/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useDelegationScope } from "@blocks-idp/iam/hooks/use-delegation-scope";
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
 * manage. Hidden for the system user, whose role form stays as it was.
 */
export const ManagedBySelect = ({
  value,
  onChange,
  excludeSlug,
  disabled,
}: Readonly<ManagedBySelectProps>) => {
  const { isRestricted, managedByCandidates } = useDelegationScope();
  const candidates = useMemo(
    () => managedByCandidates.filter((slug) => slug !== excludeSlug),
    [managedByCandidates, excludeSlug],
  );
  const { data } = useGetRoles(
    {
      page: 0,
      pageSize: OPTIONS_PAGE_SIZE,
      projectKey: "managed-by",
      sort: { property: "Name", isDescending: false },
      filter: { slugs: candidates },
    },
    { enabled: candidates.length > 0 },
  );

  if (!isRestricted) return null;

  const nameBySlug = new Map((data?.data ?? []).map((role) => [role.slug, role.name]));
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
