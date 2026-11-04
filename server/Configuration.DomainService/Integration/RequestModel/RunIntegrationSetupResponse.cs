using Blocks.Genesis;

namespace Configuration.DomainService.Integration.RequestModel;

public sealed class RunIntegrationSetupResponse : BaseMutationResponse
{
    public string? ConnectionId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? XBlocksKey { get; set; }
    public string? BaseUrl { get; set; }
    public string? Domain { get; set; }
}
