using Blocks.Genesis;

namespace Secrets.DomainService.ResponseModel
{
    public class GetSecretsRequest : IProjectKey
    {
        public string? ProjectKey { get ; set ; }
        public string SecretKey { get; set ; }
    }
}
