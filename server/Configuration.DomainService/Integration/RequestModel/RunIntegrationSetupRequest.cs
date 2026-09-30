namespace Configuration.DomainService.Integration.RequestModel;

public sealed class RunIntegrationSetupRequest
{
    public string TemplateKey { get; set; } = string.Empty;
    public string ConnectionName { get; set; } = string.Empty;

    // Server-only connect metadata. Internal members are not bindable from the public HTTP body.
    internal string? Source { get; set; }
    internal string? SiteUrl { get; set; }
}
