using Blocks.Genesis;

namespace DomainService.Projects
{
    /// <summary>
    /// Creates or updates one external identity provider for the current tenant.
    /// </summary>
    public class SaveThirdPartyJwtProviderRequest
    {
        /// <summary>Empty creates; otherwise the provider being edited.</summary>
        public string? ItemId { get; set; }

        /// <summary>
        /// Stable identifier the <c>x-blocks-idp</c> header names. Unique within a tenant, and
        /// only ever needed when two providers share both issuer and audience.
        /// <para>
        /// Required when creating. On an update <b>empty means untouched</b>, not cleared, as does
        /// the masked form the UI was shown — a provider is never left without a key.
        /// </para>
        /// </summary>
        public string Key { get; set; } = string.Empty;

        public string ProviderName { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Matched exactly against the token's <c>iss</c>.
        /// </summary>
        /// <remarks>
        /// <b>Optional.</b> Left blank, this provider receives the tokens that carry no <c>iss</c>
        /// claim at all — which some third parties do not emit — and is chosen by the
        /// <c>x-blocks-idp</c> header when more than one provider does the same. Blank is not a
        /// wildcard: an issuer-bearing token is never routed to a provider that declares none.
        /// </remarks>
        public string Issuer { get; set; } = string.Empty;

        public List<string> Audiences { get; set; } = [];

        public List<JwtSigningAlgorithm> Algorithms { get; set; } = [];

        /// <summary>
        /// One of the two key sources for the asymmetric families. Exactly one of this and
        /// <see cref="PublicCertificatePath"/> is configured; both together is refused.
        /// </summary>
        public string? JwksUrl { get; set; }

        /// <summary>
        /// The other asymmetric key source: a single public certificate, for an issuer that
        /// publishes no JWKS. The URL the certificate upload handed back, which Genesis re-fetches
        /// on every validation, so it must stay readable without credentials and never expire.
        /// </summary>
        public string? PublicCertificatePath { get; set; }

        /// <summary>
        /// Passphrase for a PKCS#12 certificate, in plaintext. Stored encrypted and never read
        /// back, so <b>empty means untouched</b> exactly as <see cref="SigningSecret"/> does.
        /// </summary>
        /// <remarks>
        /// Blank is also the ordinary case for a <c>.crt</c> or <c>.der</c>, which has nothing to
        /// protect — so it cannot be told apart from "keep what is stored" on its own, and
        /// <see cref="ClearCertificatePassword"/> exists to say the difference.
        /// </remarks>
        public string? PublicCertificatePassword { get; set; }

        /// <summary>
        /// Removes a stored certificate passphrase, for replacing a protected certificate with an
        /// unprotected one.
        /// </summary>
        /// <remarks>
        /// Needed because empty means untouched: without an explicit signal, a stored passphrase
        /// could never be taken off again, and the stale value would fail every load of the new
        /// certificate.
        /// </remarks>
        public bool ClearCertificatePassword { get; set; }

        /// <summary>
        /// Shared secret for the HMAC family, in plaintext. Stored encrypted and never read back.
        /// <b>Empty means untouched</b>, not cleared — a masked field round-trips as <c>""</c> from
        /// most frontends, and treating that as a clear would silently break authentication.
        /// </summary>
        public string? SigningSecret { get; set; }

        public string? CookieKey { get; set; }

        public ThirdPartyClaimsMappingRequest ClaimsMapping { get; set; } = new();
    }

    public class ThirdPartyClaimsMappingRequest
    {
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Roles { get; set; } = string.Empty;
    }

    public class SaveThirdPartyJwtProviderResponse : BaseResponse
    {
        public string ItemId { get; set; } = string.Empty;
    }

    /// <summary>
    /// A provider as the UI sees it. Carries no secret in any form — not the plaintext, and not
    /// the stored ciphertext.
    /// </summary>
    public class ThirdPartyJwtProviderResult
    {
        public string ItemId { get; set; } = string.Empty;

        /// <summary>
        /// Masked, never the stored value: first three and last three characters with the middle
        /// replaced. A save that sends this back unchanged is read as "leave the key alone", the
        /// same contract the signing secret uses.
        /// </summary>
        public string Key { get; set; } = string.Empty;
        public string ProviderName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string Issuer { get; set; } = string.Empty;
        public List<string> Audiences { get; set; } = [];
        public List<JwtSigningAlgorithm> Algorithms { get; set; } = [];
        public string JwksUrl { get; set; } = string.Empty;

        /// <summary>
        /// The configured certificate's URL. Safe to return: it addresses a public certificate,
        /// which is published key material rather than a secret.
        /// </summary>
        public string PublicCertificatePath { get; set; } = string.Empty;

        /// <summary>Subject of the configured certificate, read from the file when it was saved.</summary>
        public string CertificateSubject { get; set; } = string.Empty;

        /// <summary>SHA-1 thumbprint, for matching against what the provider published.</summary>
        public string CertificateThumbprint { get; set; } = string.Empty;

        /// <summary>
        /// When the configured certificate lapses, or <c>null</c> if it could not be read.
        /// </summary>
        /// <remarks>
        /// A certificate pins one key, so this is when the provider's tokens start being refused.
        /// A display value only — validation reads the certificate's own expiry, not this copy.
        /// </remarks>
        public DateTime? CertificateNotAfter { get; set; }

        public string CookieKey { get; set; } = string.Empty;

        /// <summary>Whether a signing secret is stored, so the form can mask rather than blank.</summary>
        public bool HasSigningSecret { get; set; }

        /// <summary>
        /// Whether a certificate passphrase is stored, so the form can offer to keep it rather
        /// than silently dropping it on the next save.
        /// </summary>
        public bool HasCertificatePassword { get; set; }

        public ThirdPartyClaimsMappingRequest ClaimsMapping { get; set; } = new();
    }

    public class DeleteThirdPartyJwtProviderRequest
    {
        public string ItemId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Turns third-party token trust on or off for the tenant. Off means tokens from external
    /// providers are not accepted at all, not merely deprioritised.
    /// </summary>
    public class UpdateThirdPartyJwtEnabledRequest
    {
        public bool IsEnabled { get; set; }
    }
}
