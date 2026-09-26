namespace Configuration.DomainService.Connect.RequestModel
{
    public class SaveConnectSetupRequest
    {
        public string TemplateKey { get; set; } = string.Empty;

        public string RoleId { get; set; } = string.Empty;

        public string RoleSlug { get; set; } = string.Empty;

        public string ClientCredentialId { get; set; } = string.Empty;
    }
}
