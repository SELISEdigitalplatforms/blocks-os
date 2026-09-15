/**
 * An external identity provider this project accepts tokens from.
 *
 * Deliberately carries no signing secret in any form — not the plaintext, and not the stored
 * ciphertext. `hasSigningSecret` is all the UI needs to decide between masking and prompting.
 */
export interface ThirdPartyJwtProvider {
  itemId: string;
  /** Value the `x-blocks-idp` header carries when two providers cannot be told apart. */
  key: string;
  providerName: string;
  isActive: boolean;
  issuer: string;
  audiences: string[];
  algorithms: number[];
  jwksUrl: string;
  cookieKey: string;
  hasSigningSecret: boolean;
  claimsMapping: {
    userId: string;
    email: string;
    userName: string;
    name: string;
    roles: string;
  };
}

/**
 * Whether a caller must send `x-blocks-idp` to reach this provider.
 *
 * Issuer and audience identify a provider on their own in almost every configuration, and the
 * header is then never read. It becomes necessary only where two active providers share *both* —
 * the one case where nothing in the token itself can separate them.
 */
export function requiresIdpHeader(
  provider: ThirdPartyJwtProvider,
  all: ThirdPartyJwtProvider[],
): boolean {
  return all.some(
    (other) =>
      other.itemId !== provider.itemId &&
      other.isActive &&
      other.issuer === provider.issuer &&
      sharesAnyAudience(other.audiences, provider.audiences),
  );
}

// An empty audience list means audience validation is off for that provider, so it overlaps with
// everything from the same issuer — which is exactly how two otherwise distinct providers collapse
// into one candidate set.
function sharesAnyAudience(left: string[], right: string[]): boolean {
  if (!left?.length || !right?.length) return true;
  return left.some((audience) => right.includes(audience));
}

/**
 * Stored as an int, so these values are part of the contract shared with Genesis — append, never
 * renumber. `Unspecified` exists so an unset field is rejected rather than defaulted.
 */
export enum JwtSigningAlgorithm {
  Unspecified = 0,
  RS256 = 1,
  RS384 = 2,
  RS512 = 3,
  ES256 = 4,
  ES384 = 5,
  ES512 = 6,
  PS256 = 7,
  PS384 = 8,
  PS512 = 9,
  HS256 = 10,
  HS384 = 11,
  HS512 = 12,
}

export const SIGNING_ALGORITHMS = [
  { value: JwtSigningAlgorithm.RS256, label: "RS256", symmetric: false },
  { value: JwtSigningAlgorithm.RS384, label: "RS384", symmetric: false },
  { value: JwtSigningAlgorithm.RS512, label: "RS512", symmetric: false },
  { value: JwtSigningAlgorithm.ES256, label: "ES256", symmetric: false },
  { value: JwtSigningAlgorithm.ES384, label: "ES384", symmetric: false },
  { value: JwtSigningAlgorithm.ES512, label: "ES512", symmetric: false },
  { value: JwtSigningAlgorithm.PS256, label: "PS256", symmetric: false },
  { value: JwtSigningAlgorithm.PS384, label: "PS384", symmetric: false },
  { value: JwtSigningAlgorithm.PS512, label: "PS512", symmetric: false },
  { value: JwtSigningAlgorithm.HS256, label: "HS256", symmetric: true },
  { value: JwtSigningAlgorithm.HS384, label: "HS384", symmetric: true },
  { value: JwtSigningAlgorithm.HS512, label: "HS512", symmetric: true },
] as const;

/** HMAC keys are a shared secret; everything else publishes a public key through a JWKS. */
export function isSymmetric(algorithm: JwtSigningAlgorithm): boolean {
  return (
    algorithm === JwtSigningAlgorithm.HS256 ||
    algorithm === JwtSigningAlgorithm.HS384 ||
    algorithm === JwtSigningAlgorithm.HS512
  );
}

export interface SaveThirdPartyJwtProviderPayload {
  itemId?: string;
  key: string;
  providerName: string;
  isActive: boolean;
  issuer: string;
  audiences: string[];
  algorithms: JwtSigningAlgorithm[];
  jwksUrl?: string;
  /** Plaintext on the way in only. Empty means untouched, never cleared. */
  signingSecret?: string;
  cookieKey?: string;
  claimsMapping: {
    userId: string;
    email: string;
    userName: string;
    name: string;
    roles: string;
  };
}
