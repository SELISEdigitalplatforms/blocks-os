using Microsoft.AspNetCore.Http;

namespace DomainService.Certificate
{
    public class UploadCertificateRequest
    {
        /// <summary>The certificate file itself. Sent as multipart form data.</summary>
        public IFormFile? Certificate { get; set; }

        /// <summary>
        /// Picks which slot the tenant's certificate is written to: its own, or the external
        /// identity provider's certificate that its tokens are validated against.
        /// </summary>
        public bool IsThirdParty { get; set; }

        /// <summary>
        /// Which external provider this certificate belongs to, for <see cref="IsThirdParty"/>
        /// uploads. Ignored otherwise, since a tenant has only one certificate of its own.
        /// </summary>
        /// <remarks>
        /// A tenant may trust several external providers at once, and the blob name is derived
        /// from this: without it every provider would share one slot and each upload would
        /// silently replace the previous provider's certificate. Empty keeps the original
        /// single-slot name, so certificates uploaded before this existed still resolve.
        /// </remarks>
        public string? ProviderRef { get; set; }
    }
}
