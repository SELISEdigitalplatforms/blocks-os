using Blocks.Genesis;

namespace Secrets.DomainService.ResponseModel
{
    public class DeleteSecretRequest : IProjectKey
    {
        public string ItemId { get; set; }
        public string? ProjectKey { get; set; }
    }
}