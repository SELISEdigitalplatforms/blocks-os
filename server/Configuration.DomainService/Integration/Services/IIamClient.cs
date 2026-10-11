namespace Configuration.DomainService.Integration.Services;

public interface IIamClient
{
    Task<IamPermissionsResult> GetPermissionsByResourcesAsync(IReadOnlyCollection<string> resources, CancellationToken cancellationToken = default);
    Task<IamRole?> FindRoleAsync(string slug, string name, CancellationToken cancellationToken = default);
    Task<IamMutationResult> CreateRoleAsync(string name, string slug, string? description, CancellationToken cancellationToken = default);
    Task<IamRole?> GetRoleAsync(string id, CancellationToken cancellationToken = default);
    Task<IamMutationResult> AssignPermissionsAsync(string slug, IReadOnlyCollection<string> addPermissions, string? organizationId, CancellationToken cancellationToken = default);
    Task<IamCreateCredentialResult> CreateCredentialAsync(object request, CancellationToken cancellationToken = default);
    Task<IamCredential?> FindCredentialAsync(string name, CancellationToken cancellationToken = default);
    Task<IamMutationResult> DeleteCredentialAsync(string id, CancellationToken cancellationToken = default);
    Task<IamRotateSecretResult> RotateSecretAsync(string id, CancellationToken cancellationToken = default);
}

public sealed record IamPermission(string ItemId, string Resource);
public sealed record IamRole(string ItemId, string Name, string Slug, string? OrganizationId);
public sealed record IamCredential(string ItemId, string Name, IReadOnlyList<string> Roles, IReadOnlyList<string> Permissions);
public sealed record IamPermissionsResult(IReadOnlyList<IamPermission> Permissions, string? Error = null);
public sealed record IamMutationResult(bool IsSuccess, string? ItemId = null, IReadOnlyDictionary<string, string>? Errors = null, string? Error = null);
public sealed record IamCreateCredentialResult(bool IsSuccess, string? ItemId, string? ClientSecret, IReadOnlyDictionary<string, string>? Errors = null, string? Error = null);
public sealed record IamRotateSecretResult(bool IsSuccess, string? ClientSecret, IReadOnlyDictionary<string, string>? Errors = null, string? Error = null);
