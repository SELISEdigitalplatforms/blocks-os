using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Integration.Services
{
    public class IntegrationService : IIntegrationService
    {
        private readonly IIntegrationRepository _integrationRepository;
        private readonly IValidator<RunIntegrationSetupRequest> _runValidator;
        private readonly IIamClient _iamClient;
        private readonly ILogger<IntegrationService>? _logger;
        private readonly ITenants? _tenants;

        public IntegrationService(IIntegrationRepository integrationRepository,
            IValidator<RunIntegrationSetupRequest> runValidator, IIamClient iamClient, ILogger<IntegrationService>? logger = null, ITenants? tenants = null)
        {
            _integrationRepository = integrationRepository;
            _runValidator = runValidator;
            _iamClient = iamClient;
            _logger = logger;
            _tenants = tenants;
        }

        public Task<List<IntegrationTemplate>> GetTemplatesAsync(string? family = null) =>
            _integrationRepository.GetActiveTemplatesAsync(family);

        public Task<IntegrationTemplate?> GetTemplateByKeyAsync(string key, bool includeInactive = false) =>
            _integrationRepository.GetTemplateByKeyAsync(key, includeInactive);

        public async Task<RunIntegrationSetupResponse> RunSetupAsync(RunIntegrationSetupRequest request)
        {
            if (!IsInProject()) return RunFailure("project", "Open a project environment to manage its integrations.");
            var validation = await _runValidator.ValidateAsync(request);
            if (!validation.IsValid) return new RunIntegrationSetupResponse { IsSuccess = false, Errors = validation.Errors.GroupBy(e => e.PropertyName).ToDictionary(g => g.Key, g => g.First().ErrorMessage) };
            var template = await _integrationRepository.GetTemplateByKeyAsync(request.TemplateKey);
            if (template == null) return RunFailure("template_not_found", "No active Integration template exists for this key.");
            var prefix = $"blocks-{template.Family}::";
            var invalidPermissions = string.IsNullOrWhiteSpace(template.Family)
                ? template.Permissions
                : template.Permissions.Where(p => !p.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)).ToList();
            if (string.IsNullOrWhiteSpace(template.Family) || invalidPermissions.Count > 0)
            {
                _logger?.LogError("Integration template '{TemplateKey}' was refused: permissions {InvalidPermissions} are outside the '{Prefix}' service family.", template.Key, invalidPermissions, prefix);
                return RunFailure("template_invalid", "The template contains permissions outside its service family.");
            }
            var name = request.ConnectionName.Trim();
            if (await _integrationRepository.HasActiveConnectionNamedAsync(name)) return RunFailure("connection_name", "An active connection already uses this name.");

            var permissions = await _iamClient.GetPermissionsByResourcesAsync(template.Permissions);
            if (!string.IsNullOrWhiteSpace(permissions.Error)) return RunFailure("iam_error", "IAM is unavailable for integration setup.");
            var ids = template.Permissions.Select(resource => permissions.Permissions.FirstOrDefault(p => string.Equals(p.Resource, resource, StringComparison.OrdinalIgnoreCase))?.ItemId).ToList();
            if (ids.Any(string.IsNullOrWhiteSpace)) return RunFailure("permissions_missing", "One or more template permissions do not exist in this project.");

            var role = await _iamClient.FindRoleAsync(template.RoleSlug, template.RoleName);
            if (role == null)
            {
                var created = await _iamClient.CreateRoleAsync(template.RoleName, template.RoleSlug, template.RoleDescription);
                if (!created.IsSuccess || string.IsNullOrWhiteSpace(created.ItemId)) return IamFailure(created);
                role = await _iamClient.GetRoleAsync(created.ItemId);
                if (role == null || string.IsNullOrWhiteSpace(role.Slug)) return RunFailure("iam_error", "IAM created the role but could not read it back.");
            }
            var assigned = await _iamClient.AssignPermissionsAsync(role.Slug, ids!, role.OrganizationId);
            if (!assigned.IsSuccess) return IamFailure(assigned);
            var credentialName = $"{template.ClientCredentialName} - {name}";
            var existingCredential = await _iamClient.FindCredentialAsync(credentialName);
            IamCreateCredentialResult credential;
            if (existingCredential != null)
            {
                var exactAccess = existingCredential.Roles.Count == 1 && string.Equals(existingCredential.Roles[0], role.Slug, StringComparison.OrdinalIgnoreCase) && existingCredential.Permissions.Count == 0;
                if (!exactAccess) return RunFailure("iam_error", "A credential with this connection name already exists with different access.");
                var rotated = await _iamClient.RotateSecretAsync(existingCredential.ItemId);
                if (!rotated.IsSuccess || string.IsNullOrWhiteSpace(rotated.ClientSecret)) return RunFailure("iam_error", rotated.Error ?? "IAM could not rotate the interrupted setup credential.");
                credential = new IamCreateCredentialResult(true, existingCredential.ItemId, rotated.ClientSecret);
            }
            else credential = await _iamClient.CreateCredentialAsync(new { name = credentialName, isActive = true, accessTokenValidForNumberMinutes = template.AccessTokenValidForNumberMinutes, roles = new[] { role.Slug }, permissions = Array.Empty<string>() });
            if (!credential.IsSuccess || string.IsNullOrWhiteSpace(credential.ItemId) || string.IsNullOrWhiteSpace(credential.ClientSecret)) return IamFailure(credential);

            var context = BlocksContext.GetContext()!;
            var setup = new IntegrationSetup { ItemId = Guid.NewGuid().ToString(), TemplateKey = template.Key, TemplateDisplayName = template.DisplayName, TemplateAccessLevel = template.AccessLevel, ConnectionName = name, RoleId = role.ItemId, RoleSlug = role.Slug, ClientCredentialId = credential.ItemId, Source = request.Source ?? "manual", SiteUrl = request.SiteUrl, Status = "active", CreatedBy = context.UserId, LastUpdatedBy = context.UserId, CreatedDate = DateTime.UtcNow, LastUpdatedDate = DateTime.UtcNow };
            if (!await _integrationRepository.TryInsertSetupAsync(setup)) return RunFailure("connection", "The connection could not be saved.");
            return new RunIntegrationSetupResponse { IsSuccess = true, ItemId = setup.ItemId, ConnectionId = setup.ItemId, ClientId = credential.ItemId, ClientSecret = credential.ClientSecret, XBlocksKey = context.TenantId, BaseUrl = template.BaseUrl, Domain = _tenants?.GetTenantByID(context.TenantId)?.Applications?.FirstOrDefault()?.Domain };
        }

        public async Task<BaseQueryResponse<List<IntegrationSetup>>> GetConnectionsAsync()
        {
            if (!IsInProject()) return new BaseQueryResponse<List<IntegrationSetup>> { Errors = NotInProjectErrors() };
            var connections = await _integrationRepository.GetConnectionsAsync();
            foreach (var connection in connections.Where(c => string.IsNullOrWhiteSpace(c.ConnectionName))) connection.ConnectionName = "Legacy connection";
            return new BaseQueryResponse<List<IntegrationSetup>> { Data = connections };
        }

        public async Task<BaseMutationResponse> RevokeConnectionAsync(string connectionId)
        {
            if (!IsInProject()) return new BaseMutationResponse { IsSuccess = false, Errors = NotInProjectErrors() };
            if (string.IsNullOrWhiteSpace(connectionId)) return Failure("connection", "ConnectionId must not be empty.");
            var changed = await _integrationRepository.RevokeConnectionAsync(connectionId, BlocksContext.GetContext()?.UserId);
            return changed ? new BaseMutationResponse { IsSuccess = true } : Failure("connection", "Connection was not found.");
        }

        public async Task RevokeUndeliveredConnectionAsync(string environmentTenantId, string connectionId)
        {
            if (!string.IsNullOrWhiteSpace(environmentTenantId) && !string.IsNullOrWhiteSpace(connectionId))
                await _integrationRepository.MarkConnectionNeverDeliveredAsync(environmentTenantId, connectionId);
        }

        public async Task<BaseMutationResponse> DisconnectAsync(string connectionId)
        {
            if (!IsInProject()) return new BaseMutationResponse { IsSuccess = false, Errors = NotInProjectErrors() };
            var connection = await _integrationRepository.GetConnectionAsync(connectionId);
            if (connection == null) return Failure("connection", "Connection was not found.");
            if (connection.Status == "revoked") return new BaseMutationResponse { IsSuccess = true };
            var deleted = await _iamClient.DeleteCredentialAsync(connection.ClientCredentialId);
            if (!deleted.IsSuccess) return Failure("iam_error", deleted.Error ?? "IAM could not delete the client credential.");
            return await RevokeConnectionAsync(connectionId);
        }

        public async Task<RegenerateIntegrationSecretResponse> RegenerateSecretAsync(string connectionId)
        {
            if (!IsInProject()) return new RegenerateIntegrationSecretResponse { IsSuccess = false, Errors = NotInProjectErrors() };
            var connection = await _integrationRepository.GetConnectionAsync(connectionId);
            if (connection == null || connection.Status == "revoked") return new RegenerateIntegrationSecretResponse { IsSuccess = false, Errors = new Dictionary<string, string> { ["connection"] = "An active connection was not found." } };
            var result = await _iamClient.RotateSecretAsync(connection.ClientCredentialId);
            return result.IsSuccess && !string.IsNullOrWhiteSpace(result.ClientSecret)
                ? new RegenerateIntegrationSecretResponse { IsSuccess = true, ClientSecret = result.ClientSecret }
                : new RegenerateIntegrationSecretResponse { IsSuccess = false, Errors = result.Errors?.ToDictionary(x => x.Key, x => x.Value) ?? new Dictionary<string, string> { ["iam_error"] = result.Error ?? "IAM could not rotate the client secret." } };
        }

        public async Task<CheckIntegrationReadinessResponse> CheckReadinessAsync(string templateKey)
        {
            if (!IsInProject())
                return new CheckIntegrationReadinessResponse { Ready = false, MissingPermissions = new List<string>() };

            var template = await _integrationRepository.GetTemplateByKeyAsync(templateKey);
            var missing = new List<string>();
            if (template == null || template.Permissions.Count == 0)
            {
                // Unknown template: nothing to check against, so report everything missing rather
                // than a misleading "ready".
                missing.Add(string.IsNullOrWhiteSpace(templateKey) ? "(template)" : templateKey);
                return new CheckIntegrationReadinessResponse { Ready = false, MissingPermissions = missing };
            }

            var permissions = await _iamClient.GetPermissionsByResourcesAsync(template.Permissions);
            if (!string.IsNullOrWhiteSpace(permissions.Error))
            {
                var denied = permissions.Error.Contains("401", StringComparison.Ordinal) || permissions.Error.Contains("403", StringComparison.Ordinal) || permissions.Error.Contains("permission_denied", StringComparison.OrdinalIgnoreCase);
                return new CheckIntegrationReadinessResponse { Ready = false, MissingPermissions = template.Permissions.ToList(), Error = denied ? "permission_denied" : "iam_error" };
            }

            var found = permissions.Permissions.Select(p => p.Resource).ToHashSet(StringComparer.OrdinalIgnoreCase);
            missing.AddRange(template.Permissions.Where(p => !found.Contains(p)));
            return new CheckIntegrationReadinessResponse { Ready = missing.Count == 0, MissingPermissions = missing };
        }

        // The setup lives in the tenant's own database, resolved from the request token. Outside
        // impersonation that token names the root tenant, whose database is the shared
        // BlocksConfiguration, so the record would land next to the templates instead.
        private static bool IsInProject() => BlocksContext.GetContext()?.Impersonated == true;

        private static Dictionary<string, string> NotInProjectErrors() =>
            new() { { "project", "Open a project environment to manage its integrations." } };

        private static BaseMutationResponse Failure(string key, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };

        private static RunIntegrationSetupResponse RunFailure(string key, string message) => new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
        private static RunIntegrationSetupResponse IamFailure(IamMutationResult result) => new() { IsSuccess = false, Errors = result.Errors?.ToDictionary(x => x.Key, x => x.Value) ?? new Dictionary<string, string> { ["iam_error"] = result.Error ?? "IAM could not complete integration setup." } };
        private static RunIntegrationSetupResponse IamFailure(IamCreateCredentialResult result) => new() { IsSuccess = false, Errors = result.Errors?.ToDictionary(x => x.Key, x => x.Value) ?? new Dictionary<string, string> { ["iam_error"] = result.Error ?? "IAM could not complete integration setup." } };
    }
}
