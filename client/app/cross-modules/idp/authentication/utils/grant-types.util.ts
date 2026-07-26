import { GRANT_TYPES } from "@blocks-idp/authentication/constants/authentication.constant";

const GRANT_TYPE_ALIASES: Record<string, GRANT_TYPES> = {
  client_credential: GRANT_TYPES.clientCredential,
};

export const canonicalizeGrantType = (value: string): string => GRANT_TYPE_ALIASES[value] ?? value;

export const canonicalizeGrantTypes = (values: string[] | null | undefined): string[] => {
  if (!values?.length) return [];
  return values.map(canonicalizeGrantType);
};

export const isGrantTypeSelected = (
  selected: string[] | undefined,
  optionValue: string,
): boolean => {
  if (!selected?.length) return false;
  const canonicalOption = canonicalizeGrantType(optionValue);
  return selected.some((value) => canonicalizeGrantType(value) === canonicalOption);
};
