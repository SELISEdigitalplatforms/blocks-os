using System.Text.Json.Serialization;

namespace DomainService.Projects
{
    public class UpdateProjectGroupRequest
    {
        public string ProjectGroupId { get; set; }

        // Deprecated: accepted for backward compatibility. Use ProjectGroupId.
        [JsonPropertyName("tenantGroupId")]
        public string TenantGroupId
        {
            get => ProjectGroupId;
            set => ProjectGroupId = value;
        }

        public string Name { get; set; }
    }
}
