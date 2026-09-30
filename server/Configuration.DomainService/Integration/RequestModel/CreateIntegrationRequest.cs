namespace Configuration.DomainService.Integration.RequestModel;

public sealed class CreateIntegrationRequest
{
    public string Family { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string CodeChallenge { get; set; } = string.Empty;
    public string CodeChallengeMethod { get; set; } = string.Empty;
    public string SiteName { get; set; } = string.Empty;
    public string? SuggestedTemplateKey { get; set; }
}

public sealed class CreateIntegrationRequestResponse
{
    public string RequestId { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
