namespace Configuration.DomainService.Integration.RequestModel;

/// <summary>
/// What the Approve screen needs to render a pending "Connect with Blocks" request. Carries no
/// secrets: only the template metadata the user chooses between.
/// </summary>
public sealed class GetIntegrationRequestResponse
{
    public string RequestId { get; set; } = string.Empty;
    public string SiteName { get; set; } = string.Empty;
    public string RedirectHost { get; set; } = string.Empty;
    public string Family { get; set; } = string.Empty;
    public IList<IntegrationRequestTemplate> Templates { get; set; } = Array.Empty<IntegrationRequestTemplate>();
    public string? SuggestedTemplateKey { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public sealed class IntegrationRequestTemplate
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string AccessLevel { get; set; } = string.Empty;
    public int PermissionCount { get; set; }
}

public sealed class CancelIntegrationRequest
{
    public string RequestId { get; set; } = string.Empty;
}

public sealed class CancelIntegrationRequestResponse
{
    public string RedirectUrl { get; set; } = string.Empty;
}
