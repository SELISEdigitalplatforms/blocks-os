/**
 * Which claim of an incoming token supplies each field.
 *
 * Names are matched literally against the decoded payload, so a namespaced claim is written out in
 * full. Only `userId` has no safe fallback: without it every token collapses onto one principal.
 */
export interface ClaimsMapping {
  userId: string;
  email: string;
  userName: string;
  name: string;
  roles: string;
}

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
  /** One of the two asymmetric key sources; `publicCertificatePath` is the other. */
  jwksUrl: string;
  /**
   * URL of the uploaded public certificate, for an issuer that publishes no JWKS. Safe to show:
   * it addresses published key material, not a secret.
   */
  publicCertificatePath: string;
  /** Subject of the configured certificate, read from the file when it was saved. */
  certificateSubject: string;
  /** SHA-1 thumbprint, for matching against what the provider published. */
  certificateThumbprint: string;
  /** ISO timestamp when the certificate lapses, or null if it could not be read. */
  certificateNotAfter: string | null;
  cookieKey: string;
  hasSigningSecret: boolean;
  /** Whether a PKCS#12 passphrase is stored, so the form can offer to keep it rather than drop it. */
  hasCertificatePassword: boolean;
  claimsMapping: ClaimsMapping;
}

/** Where an asymmetric provider's verification key comes from. */
export type AsymmetricKeySource = "jwks" | "certificate";

/** Extension of a stored certificate, taken from its URL. Blank for a blob saved without one. */
export function certificateExtension(path: string): string {
  return /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "";
}

/**
 * One sentence naming what a provider verifies signatures with.
 *
 * Shared by the list card, the details page and the edit form. It lived in all three separately
 * and drifted: the list card kept falling through to an em dash for a certificate-backed
 * provider, which reads as "not configured" on a provider that is working perfectly well.
 *
 * Deliberately short for a certificate, rather than the blob URL. That URL is roughly a hundred
 * characters identical across every provider bar the suffix, and it describes our storage rather
 * than the provider — unlike a JWKS URL, which is the provider's own endpoint and worth reading.
 * The full URL belongs on the details page, where there is room for it.
 */
export function keySourceLabel(provider: ThirdPartyJwtProvider): string {
  if (provider.hasSigningSecret) return "Shared secret (stored encrypted)";

  if (provider.publicCertificatePath) {
    const extension = certificateExtension(provider.publicCertificatePath);
    const suffix = extension ? ` (.${extension})` : "";
    return provider.hasCertificatePassword
      ? `Certificate${suffix} — passphrase stored`
      : `Certificate${suffix}`;
  }

  return provider.jwksUrl || "—";
}

/** How long until a certificate lapses, or null when there is nothing to say. */
export function certificateExpiry(
  provider: ThirdPartyJwtProvider,
  now: Date = new Date(),
): { on: Date; daysLeft: number; expired: boolean; expiringSoon: boolean } | null {
  if (!provider.certificateNotAfter) return null;

  const on = new Date(provider.certificateNotAfter);
  if (Number.isNaN(on.getTime())) return null;

  const daysLeft = Math.floor((on.getTime() - now.getTime()) / 86_400_000);

  // Thirty days is the window a rotation realistically needs: the provider has to issue the new
  // certificate and someone here has to upload it, and until they do every token is refused.
  return { on, daysLeft, expired: daysLeft < 0, expiringSoon: daysLeft >= 0 && daysLeft <= 30 };
}

/**
 * Which key source a stored provider is using.
 *
 * Read off the certificate path rather than the JWKS URL because the server refuses a provider
 * carrying both, so a certificate present is unambiguous. A provider with neither predates this
 * choice and reads as a JWKS, which is what the form then asks for.
 */
export function keySourceOf(provider: ThirdPartyJwtProvider): AsymmetricKeySource {
  return provider.publicCertificatePath ? "certificate" : "jwks";
}

/**
 * Certificate files the uploader accepts.
 *
 * `.crt` and `.pem` are the same PEM-encoded certificate under two names, and providers use them
 * interchangeably — refusing either would reject a usable file for its extension alone. Kept in
 * step with the server, which re-checks this list.
 */
export const CERTIFICATE_EXTENSIONS = [".crt", ".pem", ".der", ".pfx", ".p12"] as const;

/** Kept in step with the server, which refuses anything larger. */
export const CERTIFICATE_MAX_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Dropzone filter, by MIME type and by extension.
 *
 * Both are listed because browsers report certificate files inconsistently — a PEM `.crt` arrives
 * as `application/x-x509-ca-cert`, as `application/octet-stream`, or with no type at all
 * depending on the platform. The extensions are what actually make the filter reliable.
 */
export const CERTIFICATE_DROPZONE_ACCEPT = {
  "application/x-pkcs12": [".pfx", ".p12"],
  "application/x-x509-ca-cert": [".crt", ".der"],
  "application/x-pem-file": [".pem", ".crt"],
};

/**
 * Whether a file carries one of the extensions the server will accept.
 *
 * Checked on the name rather than the MIME type: browsers report certificate files
 * inconsistently, and an empty or `application/octet-stream` type would reject a perfectly good
 * `.pfx`. The server re-checks anyway, so this is only here to fail early and legibly.
 */
export function isCertificateFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return CERTIFICATE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** True for the PKCS#12 containers, the only ones a passphrase can apply to. */
export function canCarryPassphrase(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".pfx") || lower.endsWith(".p12");
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
  /** The URL the certificate upload handed back. Sent instead of `jwksUrl`, never alongside it. */
  publicCertificatePath?: string;
  /**
   * PKCS#12 passphrase, plaintext on the way in only. Empty means untouched, so
   * `clearCertificatePassword` is what says "there is no passphrase any more".
   */
  publicCertificatePassword?: string;
  /**
   * Removes a stored passphrase. Sent whenever a fresh certificate is uploaded without one, since
   * a passphrase kept from the previous file would fail every load of the new one.
   */
  clearCertificatePassword?: boolean;
  cookieKey?: string;
  claimsMapping: ClaimsMapping;
}

/**
 * Builds the payload for a save that changes only part of a provider.
 *
 * A save replaces the stored row, so a partial payload silently clears whatever it leaves out —
 * `cookieKey` above all, which is how a token is found on a cookie. Building from the row that
 * came back keeps every untouched field intact.
 *
 * The signing secret and the certificate passphrase are deliberately absent: empty means
 * untouched, so the stored ones survive. Exactly one key source is sent — a JWKS URL or a
 * certificate path for the asymmetric families, neither for HMAC — because the server refuses a
 * provider that carries more than one.
 */
export function toSavePayload(
  provider: ThirdPartyJwtProvider,
  overrides: Partial<SaveThirdPartyJwtProviderPayload> = {},
): SaveThirdPartyJwtProviderPayload {
  const symmetric = isSymmetric(provider.algorithms?.[0] as JwtSigningAlgorithm);

  return {
    itemId: provider.itemId,
    key: provider.key,
    providerName: provider.providerName,
    isActive: provider.isActive,
    issuer: provider.issuer,
    audiences: provider.audiences ?? [],
    algorithms: (provider.algorithms ?? []) as JwtSigningAlgorithm[],
    // Only the key source this provider actually uses is sent: the server refuses a payload
    // carrying both, and sending the unused one as "" would read as a clear.
    jwksUrl: symmetric || provider.publicCertificatePath ? undefined : provider.jwksUrl,
    publicCertificatePath: symmetric ? undefined : provider.publicCertificatePath || undefined,
    cookieKey: provider.cookieKey,
    claimsMapping: provider.claimsMapping,
    ...overrides,
  };
}
