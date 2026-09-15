using Blocks.Genesis;
using DomainService.Certificate;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class CertificateController : ControllerBase
    {
        private readonly ICertificateUploadService _certificateUploadService;

        public CertificateController(ICertificateUploadService certificateUploadService)
        {
            _certificateUploadService = certificateUploadService;
        }

        /// <summary>
        /// Stores a public certificate for the calling tenant and returns the URL to read it back.
        /// </summary>
        /// <remarks>
        /// The file arrives as multipart form data while the flag arrives on the query string, so
        /// both are bound explicitly - a single complex parameter would be inferred as
        /// <c>[FromBody]</c> and reject the upload. Callers also send a <c>TenantId</c> query
        /// parameter; it is ignored, because the tenant comes from the request context.
        ///
        /// <para>
        /// Gated by the same permission as UpdateTokenValidationParameters, which persists the URL
        /// this returns. The certificate is what token validation actually trusts, so it must not
        /// be writable by someone who cannot edit the configuration pointing at it.
        /// </para>
        /// </remarks>
        [HttpPost]
        [ProtectedEndPoint("blocks-os::project::mutate-token-validation-params")]
        public Task<UploadCertificateResponse> UploadCertificate(
            [FromForm] IFormFile? certificate,
            [FromQuery] bool isThirdParty)
        {
            return _certificateUploadService.UploadPublicCertificateAsync(new UploadCertificateRequest
            {
                Certificate = certificate,
                IsThirdParty = isThirdParty
            });
        }
    }
}
