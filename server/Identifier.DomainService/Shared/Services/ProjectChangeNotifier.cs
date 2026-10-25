using Blocks.Genesis;
using DomainService.Projects;
using Microsoft.Extensions.Logging;
using Os.DataAccess.Notifications;

namespace DomainService.Shared.Services
{
    /// <summary>
    /// Tells the people responsible for the current project that something in it changed.
    /// </summary>
    /// <remarks>
    /// Recipients are the project owner and the caller: there is no cheap lookup of every project
    /// admin, so the owner stands in for them (SPEC5 D4). Best effort — never throws.
    /// </remarks>
    public interface IProjectChangeNotifier
    {
        Task NotifyProjectAdminsAsync(string configurationName, string eventName, string title, string description,
            IReadOnlyDictionary<string, string?>? ids = null, CancellationToken cancellationToken = default);
    }

    public sealed class ProjectChangeNotifier : IProjectChangeNotifier
    {
        private readonly IBuiltInNotificationSender _sender;
        private readonly IProjectRepository _projectRepository;
        private readonly ILogger<ProjectChangeNotifier> _logger;

        public ProjectChangeNotifier(IBuiltInNotificationSender sender, IProjectRepository projectRepository, ILogger<ProjectChangeNotifier> logger)
        {
            _sender = sender;
            _projectRepository = projectRepository;
            _logger = logger;
        }

        public async Task NotifyProjectAdminsAsync(string configurationName, string eventName, string title, string description,
            IReadOnlyDictionary<string, string?>? ids = null, CancellationToken cancellationToken = default)
        {
            var context = BlocksContext.GetContext();
            var projectKey = context?.TenantId ?? string.Empty;
            var actorUserId = context?.UserId;

            string? ownerUserId = null;
            try
            {
                if (!string.IsNullOrWhiteSpace(projectKey))
                {
                    ownerUserId = await _projectRepository.GetOwnerUserIdAsync(projectKey);
                }
            }
            catch (Exception ex)
            {
                // The caller is still told; only the owner lookup is lost.
                _logger.LogWarning(ex, "Owner lookup for built-in notification {ConfigurationName} failed for tenant {TenantId}: {Status}",
                    configurationName, projectKey, ex.GetType().Name);
            }

            var payloadIds = new Dictionary<string, string?>(ids ?? new Dictionary<string, string?>())
            {
                ["projectKey"] = projectKey,
                ["actorUserId"] = actorUserId
            };

            await _sender.SendAsync(new BuiltInNotification
            {
                ConfigurationName = configurationName,
                Event = eventName,
                Title = title,
                Description = description,
                Ids = payloadIds,
                UserIds = [ownerUserId, actorUserId],
                ConnectionId = projectKey
            }, cancellationToken);
        }
    }
}
