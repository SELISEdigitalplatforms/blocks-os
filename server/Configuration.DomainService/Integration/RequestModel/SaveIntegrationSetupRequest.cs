namespace Configuration.DomainService.Integration.RequestModel
{
    public class SaveIntegrationSetupRequest
    {
        public string TemplateKey { get; set; } = string.Empty;

        public string RoleId { get; set; } = string.Empty;

        public string RoleSlug { get; set; } = string.Empty;

        public string ClientCredentialId { get; set; } = string.Empty;
    }
}
