using Blocks.Genesis;

namespace Cloud.DomainService.Responses
{
    public class GetApiEndpointConfigsResponse : BaseQueryListResponse<IQueryable<ApiEndpointConfigResponse>>
    {
        public int Page { get; set; }
        public int PageSize { get; set; }
        public long TotalPages => PageSize > 0 ? (long)Math.Ceiling((double)TotalCount / PageSize) : 0;
    }

    // Same JSON shape as before: the old os ApiEndpointConfig entity is now the Genesis
    // Permission, so the response carries the fields itself. Type stays an int in JSON.
    public class ApiEndpointConfigResponse : BaseEntity
    {
        public string? Controller { get; set; }
        public string? Method { get; set; }
        public string? Service { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Type { get; set; }
        public string? Description { get; set; }
        public string Resource { get; set; } = string.Empty;
        public string ResourceGroup { get; set; } = string.Empty;
        public bool IsBuiltIn { get; set; }
        public bool IsArchived { get; set; }
        public List<string> DependentPermissions { get; set; } = new();
        public List<string> Roles { get; set; } = new();
        public List<string> UserId { get; set; } = new();
        public bool IsCaptchaRequired { get; set; }
        public bool IsMFARequired { get; set; }
        public int MfaMediaType { get; set; }
        public bool IsAllowed { get; set; }
        public int Limit { get; set; }
        public int Usage { get; set; }
        public string BaseUrl { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string HttpMethod { get; set; } = string.Empty;
    }
}
