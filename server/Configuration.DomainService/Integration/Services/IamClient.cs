using System.Text.Json.Serialization;
using Blocks.Genesis;
using Blocks.Secrets;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Configuration.DomainService.Integration.Services;

/// <summary>Forwards the current user's impersonated bearer token to IAM.</summary>
public sealed class IamClient : IIamClient
{
    private readonly IHttpService _http;
    private readonly IHttpContextAccessor _context;
    private readonly Lazy<string> _baseUrl;

    public IamClient(IHttpService http, IHttpContextAccessor context, IConfiguration configuration)
    {
        _http = http;
        _context = context;
        _baseUrl = new Lazy<string>(() => FrontendRuntimeUrl.ResolveIamBaseUrl(
            configuration,
            "FrontendRuntime:BLOCKS_IAM_BASE_URL is not configured; Integration cannot call IAM."));
    }

    public async Task<IamPermissionsResult> GetPermissionsByResourcesAsync(IReadOnlyCollection<string> resources, CancellationToken cancellationToken = default)
    {
        try
        {
            var (response, error) = await _http.Post<PermissionsResponse>(new { page = 0, pageSize = Math.Max(resources.Count * 2, 1), roles = Array.Empty<string>(), filter = new { search = "", isBuiltIn = "", resources } }, Url("iam/permissions"), headers: Headers(), cancellationToken: cancellationToken);
            return new(response?.Data?.Select(p => new IamPermission(p.ItemId ?? "", p.Resource ?? "")).ToList() ?? [], error);
        }
        catch (InvalidOperationException)
        {
            return new([], "iam_error");
        }
    }

    public async Task<IamRole?> FindRoleAsync(string slug, string name, CancellationToken cancellationToken = default)
    {
        var roles = await GetRolesAsync(new { slugs = new[] { slug } }, cancellationToken);
        var found = roles.FirstOrDefault(r => string.Equals(r.Slug, slug, StringComparison.OrdinalIgnoreCase));
        if (found != null) return found;
        return (await GetRolesAsync(new { search = $"^{System.Text.RegularExpressions.Regex.Escape(name.Trim())}$" }, cancellationToken))
            .FirstOrDefault(r => string.Equals(r.Name.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public async Task<IamMutationResult> CreateRoleAsync(string name, string slug, string? description, CancellationToken cancellationToken = default)
    {
        var (response, error) = await _http.Post<MutationResponse>(new { name, slug, description = description ?? "", confirmDuplicateName = false }, Url("iam/roles/create"), headers: Headers(), cancellationToken: cancellationToken);
        if (response?.IsSuccess != true && (response?.RequiresDuplicateNameConfirmation == true || error.Contains("RequiresDuplicateNameConfirmation", StringComparison.OrdinalIgnoreCase)))
            (response, error) = await _http.Post<MutationResponse>(new { name, slug, description = description ?? "", confirmDuplicateName = true }, Url("iam/roles/create"), headers: Headers(), cancellationToken: cancellationToken);
        return ToMutation(response, error);
    }

    public async Task<IamRole?> GetRoleAsync(string id, CancellationToken cancellationToken = default)
    {
        var (response, _) = await _http.Get<RoleResponse>(Url($"iam/roles/{Uri.EscapeDataString(id)}"), Headers(), cancellationToken);
        return response?.Data?.ToRole();
    }

    public async Task<IamMutationResult> AssignPermissionsAsync(string slug, IReadOnlyCollection<string> addPermissions, string? organizationId, CancellationToken cancellationToken = default)
    {
        var (response, error) = await _http.Post<MutationResponse>(new { slug, addPermissions, removePermissions = Array.Empty<string>(), organizationId = organizationId ?? "" }, Url("iam/roles/assign-permissions"), headers: Headers(), cancellationToken: cancellationToken);
        return ToMutation(response, error);
    }

    public async Task<IamCreateCredentialResult> CreateCredentialAsync(object request, CancellationToken cancellationToken = default)
    {
        var (response, error) = await _http.Post<CredentialResponse>(request, Url("auth/client-credentials"), headers: Headers(), cancellationToken: cancellationToken);
        return new(response?.IsSuccess == true, response?.ItemId, response?.ClientSecret, response?.Errors, error);
    }

    public async Task<IamCredential?> FindCredentialAsync(string name, CancellationToken cancellationToken = default)
    {
        var (response, _) = await _http.Get<List<CredentialDto>>(Url("auth/client-credentials"), Headers(), cancellationToken);
        return response?.Where(c => string.Equals(c.Name, name, StringComparison.Ordinal))
            .OrderByDescending(c => c.CreatedDate).Select(c => c.ToCredential()).FirstOrDefault();
    }

    public async Task<IamMutationResult> DeleteCredentialAsync(string id, CancellationToken cancellationToken = default)
    {
        var (response, error) = await _http.Delete<MutationResponse>(Url($"auth/client-credentials/{Uri.EscapeDataString(id)}"), Headers(), cancellationToken: cancellationToken);
        return ToMutation(response, error);
    }

    public async Task<IamRotateSecretResult> RotateSecretAsync(string id, CancellationToken cancellationToken = default)
    {
        var (response, error) = await _http.Post<CredentialResponse>(new { }, Url($"auth/client-credentials/{Uri.EscapeDataString(id)}/rotate-secret"), headers: Headers(), cancellationToken: cancellationToken);
        return new(response?.IsSuccess == true, response?.ClientSecret, response?.Errors, error);
    }

    private async Task<List<IamRole>> GetRolesAsync(object filter, CancellationToken cancellationToken)
    {
        var (response, _) = await _http.Post<RolesResponse>(new { page = 0, pageSize = 10, filter }, Url("iam/roles"), headers: Headers(), cancellationToken: cancellationToken);
        return response?.Data?.Select(r => r.ToRole()).ToList() ?? [];
    }

    private Dictionary<string, string> Headers()
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var request = _context.HttpContext?.Request;
        if (request?.Headers.TryGetValue("Authorization", out var authorization) == true && !string.IsNullOrWhiteSpace(authorization)) headers["Authorization"] = authorization!;
        if (request?.Headers.TryGetValue("X-Blocks-Key", out var key) == true && !string.IsNullOrWhiteSpace(key)) headers["X-Blocks-Key"] = key!;
        return headers;
    }

    private string Url(string path) => $"{_baseUrl.Value.TrimEnd('/')}/api/{path}";
    private static IamMutationResult ToMutation(MutationResponse? response, string error) => new(response?.IsSuccess == true, response?.ItemId, response?.Errors, error);

    private class MutationResponse { [JsonPropertyName("isSuccess")] public bool IsSuccess { get; set; } [JsonPropertyName("itemId")] public string? ItemId { get; set; } [JsonPropertyName("errors")] public Dictionary<string, string>? Errors { get; set; } [JsonPropertyName("requiresDuplicateNameConfirmation")] public bool RequiresDuplicateNameConfirmation { get; set; } }
    private sealed class CredentialResponse : MutationResponse { [JsonPropertyName("clientSecret")] public string? ClientSecret { get; set; } }
    private sealed class PermissionsResponse { [JsonPropertyName("data")] public List<PermissionDto>? Data { get; set; } }
    private sealed class PermissionDto { [JsonPropertyName("itemId")] public string? ItemId { get; set; } [JsonPropertyName("resource")] public string? Resource { get; set; } }
    private sealed class RolesResponse { [JsonPropertyName("data")] public List<RoleDto>? Data { get; set; } }
    private sealed class RoleResponse { [JsonPropertyName("data")] public RoleDto? Data { get; set; } }
    private sealed class RoleDto { [JsonPropertyName("itemId")] public string? ItemId { get; set; } [JsonPropertyName("name")] public string? Name { get; set; } [JsonPropertyName("slug")] public string? Slug { get; set; } [JsonPropertyName("organizationId")] public string? OrganizationId { get; set; } public IamRole ToRole() => new(ItemId ?? "", Name ?? "", Slug ?? "", OrganizationId); }
    private sealed class CredentialDto { [JsonPropertyName("itemId")] public string? ItemId { get; set; } [JsonPropertyName("name")] public string? Name { get; set; } [JsonPropertyName("roles")] public List<string>? Roles { get; set; } [JsonPropertyName("permissions")] public List<string>? Permissions { get; set; } [JsonPropertyName("createdDate")] public DateTime CreatedDate { get; set; } public IamCredential ToCredential() => new(ItemId ?? "", Name ?? "", Roles ?? [], Permissions ?? []); }
}
