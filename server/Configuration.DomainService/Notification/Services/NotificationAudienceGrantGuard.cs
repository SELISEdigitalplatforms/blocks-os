using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Integration.Services;
using Configuration.DomainService.Shared.Utilities;

namespace Configuration.DomainService.Notification.Services
{
    /// <summary>
    /// Keeps an editor from handing a notification to a role or permission they neither hold nor manage
    /// (the IAM grant scope), so the Selected audience cannot be used to reach what the editor may not touch.
    /// </summary>
    public interface INotificationAudienceGrantGuard
    {
        /// <summary>The error key when the audience adds a role or permission outside the editor's grant scope, else null. Roles and permissions already stored are not re-checked.</summary>
        Task<string?> FindRefusalAsync(NotificationAudience requested, NotificationAudience? stored, CancellationToken cancellationToken = default);
    }

    public sealed class NotificationAudienceGrantGuard : INotificationAudienceGrantGuard
    {
        private readonly IIamClient _iamClient;

        public NotificationAudienceGrantGuard(IIamClient iamClient)
        {
            _iamClient = iamClient;
        }

        public async Task<string?> FindRefusalAsync(NotificationAudience requested, NotificationAudience? stored, CancellationToken cancellationToken = default)
        {
            var addedRoles = Added(requested.Roles, stored?.Roles);
            var addedPermissions = Added(requested.Permissions, stored?.Permissions);
            if (addedRoles.Count == 0 && addedPermissions.Count == 0)
            {
                return null;
            }

            // Fail closed: without an answer from IAM nothing new is handed out.
            var scope = await _iamClient.GetGrantScopeAsync(cancellationToken);
            if (scope is null)
            {
                return Constants.NotificationGrantScopeUnavailable;
            }

            if (scope.IsSystemUser)
            {
                return null;
            }

            var roles = new HashSet<string>(scope.HeldRoles.Concat(scope.ManagedRoles), StringComparer.OrdinalIgnoreCase);
            var permissions = new HashSet<string>(scope.HeldPermissions, StringComparer.OrdinalIgnoreCase);

            return addedRoles.All(roles.Contains) && addedPermissions.All(permissions.Contains)
                ? null
                : Constants.NotificationAudienceNotAllowed;
        }

        private static List<string> Added(IEnumerable<string>? requested, IEnumerable<string>? stored)
        {
            var known = new HashSet<string>(stored ?? [], StringComparer.OrdinalIgnoreCase);
            return (requested ?? []).Where(r => !string.IsNullOrWhiteSpace(r) && !known.Contains(r.Trim())).Select(r => r.Trim()).ToList();
        }
    }
}
