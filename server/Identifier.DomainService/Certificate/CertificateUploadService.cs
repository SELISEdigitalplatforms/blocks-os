using Blocks.Genesis;
using DomainService.Storage;
using Microsoft.AspNetCore.Http;
using StorageDriver;

namespace DomainService.Certificate
{
    /// <summary>
    /// Stores the public certificates that incoming JWTs are validated against.
    /// </summary>
    /// <remarks>
    /// Deliberately bypasses the DMS pipeline: there is no file record, no version and no file id.
    /// Two properties drive that choice. The blob name is derived from the tenant, so the slot is
    /// addressable without a lookup and a re-upload replaces the certificate in place; and the URL
    /// handed back has to stay valid indefinitely and be readable without credentials, because
    /// Genesis re-fetches it with a bare <see cref="System.Net.Http.HttpClient"/> every time it
    /// validates an external token. A DMS URL is a SAS that would expire underneath it.
    ///
    /// <para>
    /// The write goes through <see cref="IStorageDriverService.UploadPublicObjectAsync"/>, which
    /// resolves the tenant's Default storage configuration, makes the shared <c>certificates</c>
    /// container readable without credentials (the container access level on Azure, a bucket
    /// policy on that one bucket on S3) and returns the object's permanent URL. That is the same
    /// container blocks-data and blocks-logic write to, so a certificate uploaded through any of
    /// them resolves identically. An SFTP configuration has no public read and is answered with a
    /// clear error.
    /// </para>
    /// </remarks>
    public class CertificateUploadService : ICertificateUploadService
    {
        private readonly IStorageDriverService _storageDriverService;

        private const string CertificateContainerName = "certificates";
        private const string ThirdPartyBlobSuffix = "_3rdparty";
        private const string FallbackContentType = "application/octet-stream";
        private const long MaxCertificateSizeInBytes = 2 * 1024 * 1024;
        private const int MaxProviderRefLength = 64;

        // Kept in step with the client-side dropzone. Cryptographic validation is not possible
        // here: a password-protected .pfx can only be parsed with the password, and the client
        // sends that to UpdateTokenValidationParameters rather than to this endpoint.
        //
        // .pem and .crt hold the same PEM-encoded certificate and are used interchangeably by
        // providers, so refusing one of the two would only reject a file for its name.
        private static readonly string[] AllowedExtensions = [".crt", ".pem", ".der", ".pfx", ".p12"];

        public CertificateUploadService(IStorageDriverService storageDriverService)
        {
            _storageDriverService = storageDriverService;
        }

        public async Task<UploadCertificateResponse> UploadPublicCertificateAsync(UploadCertificateRequest request)
        {
            // Taken from the request context, never from the caller. The blob name is derived from
            // it, so a caller-supplied tenant would let anyone overwrite another tenant's
            // certificate and mint tokens that tenant's services accept.
            var tenantId = BlocksContext.GetContext()?.TenantId;

            if (string.IsNullOrWhiteSpace(tenantId))
            {
                return Error("tenant", "tenant_context_missing");
            }

            var rejection = ValidateCertificate(request.Certificate);

            if (rejection is not null)
            {
                return rejection;
            }

            var certificate = request.Certificate!;

            try
            {
                await using var stream = certificate.OpenReadStream();

                var url = await _storageDriverService.UploadPublicObjectAsync(
                    CertificateContainerName,
                    BuildBlobName(
                        tenantId,
                        request.IsThirdParty,
                        request.ProviderRef,
                        Path.GetExtension(certificate.FileName)),
                    stream,
                    string.IsNullOrWhiteSpace(certificate.ContentType)
                        ? FallbackContentType
                        : certificate.ContentType);

                return new UploadCertificateResponse
                {
                    IsSuccess = true,
                    DownloadUrl = url
                };
            }
            catch (PublicObjectStorageException ex)
            {
                // Genesis reads the certificate back anonymously, so the container has to serve
                // objects without credentials. A store that refuses to (public blob access
                // disabled on the account, an SFTP configuration) fails here with the provider's
                // own code, which is far easier to diagnose than tokens quietly 401ing later.
                return Error("storage", ex.ErrorCode);
            }
        }

        /// <summary>
        /// Derives the blob a certificate lives in. Deterministic on purpose: the slot can be
        /// addressed from the tenant id and provider alone, and re-uploading replaces that
        /// certificate rather than accumulating copies. The suffix keeps an external provider's
        /// certificate from overwriting the tenant's own.
        /// </summary>
        /// <remarks>
        /// <para>
        /// <paramref name="providerRef"/> is what keeps several external providers on one tenant
        /// apart. It is omitted from the name when blank, so the single slot that predates
        /// multi-provider support still resolves to the certificate already stored in it.
        /// </para>
        /// <para>
        /// <paramref name="extension"/> is carried through so the stored URL says what kind of
        /// file it points at. Nothing reading the certificate depends on it — both Genesis and the
        /// admin UI sniff the content — but without it the URL ends in an opaque identifier, which
        /// leaves an operator no way to tell a PKCS#12 that needs a passphrase from a bare
        /// certificate that does not. Re-uploading a different <em>kind</em> of file therefore
        /// lands on a new blob rather than replacing the old one, which is the honest outcome:
        /// the passphrase that unlocked the old file does not apply to the new one either.
        /// </para>
        /// </remarks>
        public static string BuildBlobName(
            string tenantId,
            bool isThirdParty,
            string? providerRef = null,
            string? extension = null)
        {
            if (!isThirdParty)
            {
                return tenantId;
            }

            var reference = SanitizeProviderRef(providerRef);

            var name = string.IsNullOrEmpty(reference)
                ? $"{tenantId}{ThirdPartyBlobSuffix}"
                : $"{tenantId}{ThirdPartyBlobSuffix}_{reference}";

            return name + SanitizeExtension(extension);
        }

        /// <summary>
        /// Reduces an uploaded file's extension to something safe to append to a blob name.
        /// </summary>
        /// <remarks>
        /// Validation has already restricted the upload to the allowed list, so this is defence in
        /// depth rather than the check that matters: the extension reaches here from a
        /// caller-supplied file name, and it is being concatenated into the path a blob is written
        /// to. Anything unexpected yields no suffix rather than a rejected upload, because the
        /// extension is cosmetic and losing it is not worth failing on.
        /// </remarks>
        private static string SanitizeExtension(string? extension)
        {
            if (string.IsNullOrWhiteSpace(extension))
            {
                return string.Empty;
            }

            var trimmed = extension.Trim().ToLowerInvariant();

            return AllowedExtensions.Contains(trimmed, StringComparer.Ordinal)
                ? trimmed
                : string.Empty;
        }

        /// <summary>
        /// Reduces a caller-supplied provider reference to characters that are safe in a blob name.
        /// </summary>
        /// <remarks>
        /// The reference reaches here from a query string, and it decides which blob is written.
        /// Anything outside this set — a slash above all — could address a blob outside the slot
        /// this tenant and provider own. Length capped for the same reason a blob name is bounded.
        /// </remarks>
        private static string SanitizeProviderRef(string? providerRef)
        {
            if (string.IsNullOrWhiteSpace(providerRef))
            {
                return string.Empty;
            }

            var safe = new string([.. providerRef
                .Trim()
                .Where(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_')]);

            return safe.Length <= MaxProviderRefLength ? safe : safe[..MaxProviderRefLength];
        }

        private static UploadCertificateResponse? ValidateCertificate(IFormFile? certificate)
        {
            if (certificate is null || certificate.Length == 0)
            {
                return Error("certificate", "certificate_file_is_required");
            }

            if (certificate.Length > MaxCertificateSizeInBytes)
            {
                return Error("certificate", "certificate_exceeds_maximum_size");
            }

            var extension = Path.GetExtension(certificate.FileName);

            return AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase)
                ? null
                : Error("certificate", "unsupported_certificate_extension");
        }

        private static UploadCertificateResponse Error(string field, string message) =>
            new()
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { field, message } }
            };
    }
}
