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

        public string Issuer { get; set; } = string.Empty;

        public List<string> Audiences { get; set; } = [];

        public List<JwtSigningAlgorithm> Algorithms { get; set; } = [];

        /// <summary>Key source for the asymmetric families.</summary>
        public string? JwksUrl { get; set; }

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
        public string CookieKey { get; set; } = string.Empty;

        /// <summary>Whether a signing secret is stored, so the form can mask rather than blank.</summary>
        public bool HasSigningSecret { get; set; }

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
