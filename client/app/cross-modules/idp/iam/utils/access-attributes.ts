import { AccessAttributes, UserAttributes } from "@blocks-idp/iam/models/user";

/** Attribute names are plain identifiers: they become `Auth.Attributes.<name>` in policies. */
export const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z_]\w*$/;

export const getOrgAccessAttributes = (
  attributes: UserAttributes | undefined,
  organizationId: string,
): AccessAttributes => attributes?.access?.[organizationId] ?? {};

/**
 * `attributes` with one organization's access attributes replaced. Every other key, and every
 * other organization, is carried over untouched; empty names and values are dropped.
 */
export const withOrgAccessAttributes = (
  attributes: UserAttributes | undefined,
  organizationId: string,
  next: AccessAttributes,
): UserAttributes => {
  const cleaned: AccessAttributes = {};
  for (const [name, values] of Object.entries(next)) {
    const kept = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    if (kept.length > 0) cleaned[name] = kept;
  }
  return {
    ...attributes,
    access: { ...attributes?.access, [organizationId]: cleaned },
  };
};

export const addAttributeValue = (
  current: AccessAttributes,
  name: string,
  value: string,
): AccessAttributes => {
  const existing = current[name] ?? [];
  return existing.includes(value) ? current : { ...current, [name]: [...existing, value] };
};

export const removeAttributeValue = (
  current: AccessAttributes,
  name: string,
  value: string,
): AccessAttributes => ({
  ...current,
  [name]: (current[name] ?? []).filter((item) => item !== value),
});

export const sameAccessAttributes = (a: AccessAttributes, b: AccessAttributes): boolean => {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].every((name) => {
    const left = [...(a[name] ?? [])].sort((x, y) => x.localeCompare(y));
    const right = [...(b[name] ?? [])].sort((x, y) => x.localeCompare(y));
    return left.length === right.length && left.every((value, index) => value === right[index]);
  });
};
