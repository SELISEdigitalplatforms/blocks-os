using Blocks.Genesis;
using Secrets.DomainService.Entities;

namespace Secrets.DomainService.ResponseModel
{
    public class GetSecretsRequest 
    {
        public string SecretKey { get; set; }
        public int? PageSize { get; set; }
        public int ? PageNumber { get; set; }
    }
    public sealed class GetSecretsResponse
    {
        public List<Secret> Data { get; init; } = [];
        public long TotalCount { get; init; }
    }
}
