namespace DomainService.Certificate
{
    /// <summary>
    /// Stores a public certificate that incoming JWTs are validated against. Distinct from
    /// <see cref="ICertificateStorage"/>, which persists the private key material this tenant
    /// signs its own tokens with.
    /// </summary>
    public interface ICertificateUploadService
    {
        Task<UploadCertificateResponse> UploadPublicCertificateAsync(UploadCertificateRequest request);
    }
}
