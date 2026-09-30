namespace Configuration.DomainService.Integration.RequestModel;

public sealed class ApproveIntegrationRequest
{
    public string RequestId { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;
}

public sealed class ApproveIntegrationRequestResponse
{
    public string RedirectUrl { get; set; } = string.Empty;
}

public sealed class ExchangeIntegrationRequest
{
    public string Code { get; set; } = string.Empty;
    public string CodeVerifier { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}

/// <summary>
/// The keys a CMS needs after Exchange. This is the only response besides RunSetup and
/// RegenerateSecret that ever carries a client secret — and it goes server to server, one time.
/// </summary>
public sealed class ExchangeIntegrationRequestResponse
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string XBlocksKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;
    public string AccessLevel { get; set; } = string.Empty;
}
