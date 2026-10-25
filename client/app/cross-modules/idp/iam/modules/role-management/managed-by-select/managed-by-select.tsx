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
import { IRole } from "@blocks-idp/iam/models/role";
import { useEffect, useMemo } from "react";

/** True for the role itself or a role below it: picking it as the parent would close a loop. */
const isSelfOrBelow = (role: IRole, slug: string | undefined): boolean =>
  slug !== undefined && (role.slug === slug || (role.ancestorRoleSlugs ?? []).includes(slug));

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
 * "Managed by": the role above this one. The system user and a top user may pick any role of the
 * organization, or none (standalone). A descendant must pick one of its power roles or a role below
 * them -- never none -- so the field starts on its own role. Hidden until the grant scope has loaded.
 * A role is never offered below itself or below a role under it: the server refuses that loop.
 */
export const ManagedBySelect = ({
  value,
  onChange,
  excludeSlug,
  disabled,
}: Readonly<ManagedBySelectProps>) => {
  const { scope, isDescendant, managedByCandidates } = useGrantScope();
  const seesEveryRole = scope !== undefined && !isDescendant;
  const descendantCandidates = useMemo(
    () => managedByCandidates.filter((slug) => slug !== excludeSlug),
    [managedByCandidates, excludeSlug],
  );
  const { data } = useGetRoles(
    {
      page: 0,
      pageSize: OPTIONS_PAGE_SIZE,
      projectKey: "managed-by",
      sort: { property: "Name", isDescending: false },
      filter: seesEveryRole ? { search: "" } : { slugs: descendantCandidates },
    },
    { enabled: seesEveryRole || descendantCandidates.length > 0 },
  );

  const roles = useMemo(() => data?.data ?? [], [data]);
  const candidates = useMemo(
    () =>
      seesEveryRole
        ? roles.filter((role) => !isSelfOrBelow(role, excludeSlug)).map((role) => role.slug)
        : descendantCandidates,
    [seesEveryRole, roles, excludeSlug, descendantCandidates],
  );

  // A descendant may not create a standalone role, so the field starts on its first own role.
  const firstCandidate = candidates[0];
  useEffect(() => {
    if (isDescendant && !value && firstCandidate) onChange(firstCandidate);
  }, [isDescendant, value, firstCandidate, onChange]);

  if (!scope) return null;

  const nameBySlug = new Map(roles.map((role) => [role.slug, role.name]));
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
          {!isDescendant && <SelectItem value={NO_PARENT}>No one</SelectItem>}
          {options.map((slug) => (
            <SelectItem key={slug} value={slug}>
              {nameBySlug.get(slug) ?? slug}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormDescription>
        {isDescendant
          ? "Required. The role sits below your role, so you can manage it."
          : "Holders of the chosen role can manage this role. No one = standalone."}
      </FormDescription>
    </FormItem>
  );
};
