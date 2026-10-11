using Blocks.Genesis;

namespace Configuration.DomainService.Integration.RequestModel;

public sealed class RegenerateIntegrationSecretResponse : BaseMutationResponse
{
    public string? ClientSecret { get; set; }
}
