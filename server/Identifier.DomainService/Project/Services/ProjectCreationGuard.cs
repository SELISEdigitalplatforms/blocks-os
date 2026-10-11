using DomainService.Billing.Models;
using DomainService.Billing.Services;
using DomainService.Catalogue.Services;
using DomainService.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DomainService.Projects
{
    public interface IProjectCreationGuard
    {
        /// <summary>
        /// What Project/Create may not do, or null when the request is allowed.
        /// </summary>
        /// <remarks>
        /// Create is not a purchase. With <c>Billing:RequirePaidEnvironments</c> on — the default —
        /// it may make only the free environment, and only while the project's free allowance is
        /// unused; everything else is bought through checkout, which is where it is paid for.
        /// </remarks>
        Task<Dictionary<string, string>?> CheckAsync(CreateProjectRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gives each free environment just created its quota rows, on the free limit set — what
        /// provisioning does for one bought through checkout. Never throws: the project exists.
        /// </summary>
        Task SeedFreeEnvironmentsAsync(CreateProjectRequest request, string tenantGroupId, CancellationToken cancellationToken = default);
    }

    public sealed class ProjectCreationGuard : IProjectCreationGuard
    {
        public const string RequirePaidEnvironmentsKey = "Billing:RequirePaidEnvironments";

        /// <summary>The reason an environment is refused at Create. Buy it through checkout instead.</summary>
        public const string RequiresCheckout = "environment_requires_checkout";

        private readonly IProjectInventory _inventory;
        private readonly ICatalogueProvider _catalogue;
        private readonly IResourceLimitSeeder _seeder;
        private readonly IRepositoryDeploymentService _deployments;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ProjectCreationGuard> _logger;
        private readonly TimeProvider _time;

        public ProjectCreationGuard(
            IProjectInventory inventory,
            ICatalogueProvider catalogue,
            IResourceLimitSeeder seeder,
            IRepositoryDeploymentService deployments,
            IConfiguration configuration,
            ILogger<ProjectCreationGuard> logger,
            TimeProvider? timeProvider = null)
        {
            _inventory = inventory;
            _catalogue = catalogue;
            _seeder = seeder;
            _deployments = deployments;
            _configuration = configuration;
            _logger = logger;
            _time = timeProvider ?? TimeProvider.System;
        }

        /// <summary>
        /// On unless configured off. A missing key is the safe answer: an environment that should
        /// have been paid for and was not is the failure this exists to prevent.
        /// </summary>
        private bool RequirePaid => _configuration.GetValue<bool?>(RequirePaidEnvironmentsKey) ?? true;

        public async Task<Dictionary<string, string>?> CheckAsync(CreateProjectRequest request, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);

            var catalogue = _catalogue.Catalogue;
            var environments = (request.applicationContexts ?? [])
                .Where(c => c is not null && !string.IsNullOrWhiteSpace(c.Environment))
                .Select(c => c.Environment)
                .ToList();

            var isNewGroup = string.IsNullOrWhiteSpace(request.TenantGroupId);
            var held = isNewGroup
                ? new ProjectInventorySnapshot()
                : await _inventory.GetAsync(request.TenantGroupId!, null, cancellationToken).ConfigureAwait(false);

            if (RequirePaid)
            {
                var freeInRequest = new Dictionary<string, int>(StringComparer.Ordinal);

                foreach (var environment in environments)
                {
                    if (!catalogue.Environments.TryGetValue(environment, out var definition) || !definition.FreeTierAvailable)
                    {
                        return Refuse("Environments", RequiresCheckout);
                    }

                    // An order is already creating it: checkout's own guard, applied here too, so
                    // Create cannot slip a second one in beside a paid build.
                    if (held.InFlight.Contains(environment))
                    {
                        return Refuse("Environments", CheckoutFailures.EnvironmentExists);
                    }

                    freeInRequest[environment] = freeInRequest.GetValueOrDefault(environment) + 1;

                    if (held.FreeHeld(environment) + freeInRequest[environment] > Math.Max(0, definition.MaxFreePerProject))
                    {
                        return Refuse("Environments", CheckoutFailures.FreeTierTaken);
                    }
                }
            }

            // A plan is accepted on a new project only; an existing one changes it through
            // SaveRepositoryDeployments, which reads the project's own repositories.
            if (isNewGroup && request.RepositoryDeployments is { Count: > 0 })
            {
                var limits = await _deployments
                    .RepoLimitsAsync(null, FreeCreated(environments), cancellationToken)
                    .ConfigureAwait(false);

                var (plan, error) = _deployments.Validate(request.Resources, request.RepositoryDeployments, limits);

                if (error is not null)
                {
                    return Refuse("Deployments", error);
                }

                request.RepositoryDeployments = plan;
            }

            return null;
        }

        public async Task SeedFreeEnvironmentsAsync(CreateProjectRequest request, string tenantGroupId, CancellationToken cancellationToken = default)
        {
            if (request?.applicationContexts is null || string.IsNullOrWhiteSpace(tenantGroupId))
            {
                return;
            }

            var periodKey = _time.GetUtcNow().UtcDateTime.ToString("yyyy-MM-dd");

            foreach (var environment in FreeCreated(request.applicationContexts.Where(c => c is not null).Select(c => c.Environment)))
            {
                // Derived exactly as SaveProjectAsync derives it, so the rows land on the tenant
                // that was just written.
                var tenantId = IdentifierHelper.EnvironmentMapper(environment).ToUpperInvariant() + tenantGroupId;

                try
                {
                    await _seeder.SyncAsync(tenantId, environment, periodKey, freeTier: true, cancellationToken).ConfigureAwait(false);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    // The project is created; failing the request now would invite a retry that
                    // creates nothing new. The rows are re-synced by the usage screen's sync.
                    _logger.LogError(
                        exception,
                        "Seeding free-tier quota for {TenantId} ({Environment}) failed; run a usage sync for it.",
                        tenantId,
                        environment);
                }
            }
        }

        /// <summary>Environments among these that run on the free tier when created by Create.</summary>
        private IEnumerable<string> FreeCreated(IEnumerable<string> environments)
        {
            var catalogue = _catalogue.Catalogue;

            return environments
                .Where(e => !string.IsNullOrWhiteSpace(e)
                    && catalogue.Environments.TryGetValue(e, out var definition)
                    && definition.FreeTierAvailable)
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        private static Dictionary<string, string> Refuse(string key, string reason) =>
            new() { [key] = reason };
    }
}
