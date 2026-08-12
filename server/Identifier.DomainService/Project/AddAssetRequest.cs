
using Blocks.Genesis;
using System.Text.Json.Serialization;

namespace DomainService.Projects
{
    public class AddAssetRequest
    {
        public string TenantGroupId { get; set; }
        public Resource Resource { get; set; }
    }

    public class DeleteAssetRequest
    {
        public string TenantGroupId { get; set; }
        public string ResourceId { get; set; }
    }

    /// <summary>What AddAsset actually did, so the caller can tell an import from a rename or
    /// from bringing a previously deleted repository back.</summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AssetMutationStatus
    {
        Added,
        Updated,
        Unchanged,
        Restored
    }

    public class AddAssetResponse : BaseResponse
    {
        public AssetMutationStatus Status { get; set; }
    }
}
