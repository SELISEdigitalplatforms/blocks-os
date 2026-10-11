using Blocks.Genesis;
using DomainService.Billing.Services;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using DomainService.Shared.Entities;

namespace DomainService.Projects
{
    public interface IRepositoryDeploymentService
    {
        /// <summary>The project's repository → environments plan, and each environment's repo limit.</summary>
        Task<GetRepositoryDeploymentsResponse> GetAsync(string tenantGroupId, CancellationToken cancellationToken = default);

        /// <summary>Replaces the plan, after checking it against the project and the catalogue.</summary>
        Task<SaveRepositoryDeploymentsResponse> SaveAsync(SaveRepositoryDeploymentsRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Checks a plan and returns it cleaned up (aliases resolved, duplicates and empty rows
        /// dropped), or the reason it cannot be accepted.
        /// </summary>
        /// <param name="resources">The project's repositories. Archived ones are not deployable.</param>
        /// <param name="repoLimits">Repositories allowed per environment; the catalogue's unlimited value means no cap.</param>
        (List<RepositoryDeployment>? Plan, string? Error) Validate(
            IEnumerable<Resource>? resources,
            IEnumerable<RepositoryDeployment>? deployments,
            IReadOnlyDictionary<string, long> repoLimits);

        /// <summary>
        /// Repositories allowed in each catalogue environment for this project: the catalogue's
        /// <c>release.repos</c> — the free set where the environment runs free — plus any
        /// purchased units on its quota row.
        /// </summary>
        /// <param name="creatingFree">Environments being created right now on the free tier.</param>
        Task<Dictionary<string, long>> RepoLimitsAsync(
            string? tenantGroupId,
            IEnumerable<string>? creatingFree = null,
            CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// The create-project "Add repositories" grid: which repository goes to which environment,
    /// held on the project group in blocks-os. A plan only — per-branch deploy wiring lives in
    /// blocks-release and is not driven from here (decision 2026-10-11).
    /// </summary>
    public sealed class RepositoryDeploymentService : IRepositoryDeploymentService
    {
        public const string ReposMeter = "release.repos";

        private readonly IProjectRepository _projects;
        private readonly ICatalogueProvider _catalogue;
        private readonly IProjectInventory _inventory;
        private readonly IUsageService _usage;

        public RepositoryDeploymentService(
            IProjectRepository projects,
            ICatalogueProvider catalogue,
            IProjectInventory inventory,
            IUsageService usage)
        {
            _projects = projects;
            _catalogue = catalogue;
            _inventory = inventory;
            _usage = usage;
        }

        public async Task<GetRepositoryDeploymentsResponse> GetAsync(string tenantGroupId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(tenantGroupId))
            {
                return Refused<GetRepositoryDeploymentsResponse>("TenantGroupId", "TenantGroupId is required.");
            }

            var group = await _projects.GetTenantAssetByGroupIdAsync(tenantGroupId).ConfigureAwait(false);

            if (group is null)
            {
                return Refused<GetRepositoryDeploymentsResponse>("TenantGroupId", "project_not_found");
            }

            // A repository removed from the project is archived, not deleted; its row in the plan
            // stays stored but is not shown, and comes back if the repository does.
            var live = LiveResourceIds(group.Resources);

            return new GetRepositoryDeploymentsResponse
            {
                IsSuccess = true,
                TenantGroupId = tenantGroupId,
                Deployments = [.. (group.RepositoryDeployments ?? [])
                    .Where(d => d is not null && live.Contains(d.ResourceId))],
                RepoLimits = await RepoLimitsAsync(tenantGroupId, null, cancellationToken).ConfigureAwait(false),
            };
        }

        public async Task<SaveRepositoryDeploymentsResponse> SaveAsync(SaveRepositoryDeploymentsRequest request, CancellationToken cancellationToken = default)
        {
            if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
            {
                return Refused<SaveRepositoryDeploymentsResponse>("TenantGroupId", "TenantGroupId is required.");
            }

            var group = await _projects.GetTenantAssetByGroupIdAsync(request.TenantGroupId).ConfigureAwait(false);

            if (group is null)
            {
                return Refused<SaveRepositoryDeploymentsResponse>("TenantGroupId", "project_not_found");
            }

            var limits = await RepoLimitsAsync(request.TenantGroupId, null, cancellationToken).ConfigureAwait(false);
            var (plan, error) = Validate(group.Resources, request.Deployments, limits);

            if (error is not null)
            {
                return Refused<SaveRepositoryDeploymentsResponse>("Deployments", error);
            }

            if (!await _projects.UpdateRepositoryDeploymentsAsync(request.TenantGroupId, plan!).ConfigureAwait(false))
            {
                return Refused<SaveRepositoryDeploymentsResponse>("TenantGroupId", "project_not_found");
            }

            return new SaveRepositoryDeploymentsResponse { IsSuccess = true, Deployments = plan! };
        }

        public (List<RepositoryDeployment>? Plan, string? Error) Validate(
            IEnumerable<Resource>? resources,
            IEnumerable<RepositoryDeployment>? deployments,
            IReadOnlyDictionary<string, long> repoLimits)
        {
            var catalogue = _catalogue.Catalogue;
            var live = LiveResourceIds(resources);
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var perEnvironment = new Dictionary<string, int>(StringComparer.Ordinal);
            var plan = new List<RepositoryDeployment>();
            var rows = deployments?.ToList() ?? [];

            if (rows.Count > MaxRows)
            {
                return (null, $"too_many_deployments:{MaxRows}");
            }

            foreach (var row in rows)
            {
                var resourceId = row?.ResourceId?.Trim() ?? string.Empty;

                if (resourceId.Length == 0 || !live.Contains(resourceId))
                {
                    return (null, $"unknown_resource:{resourceId}");
                }

                // One row per repository. Two rows for the same one would let the same repository
                // be counted twice in an environment, or contradict itself.
                if (!seen.Add(resourceId))
                {
                    return (null, $"duplicate_resource:{resourceId}");
                }

                var environments = new List<string>();

                foreach (var raw in row!.Environments ?? [])
                {
                    var environment = Normalise(raw, catalogue);

                    if (environment is null)
                    {
                        return (null, $"unknown_environment:{raw}");
                    }

                    if (environments.Contains(environment, StringComparer.Ordinal))
                    {
                        continue;
                    }

                    environments.Add(environment);
                    perEnvironment[environment] = perEnvironment.GetValueOrDefault(environment) + 1;
                }

                // A repository deployed nowhere is simply not in the plan.
                if (environments.Count > 0)
                {
                    plan.Add(new RepositoryDeployment { ResourceId = resourceId, Environments = environments });
                }
            }

            // In catalogue rank order, so the first environment named in an error is the lowest —
            // the same one on every attempt, whatever order the client sent.
            foreach (var (environment, _) in catalogue.Environments.OrderBy(e => e.Value.Rank))
            {
                if (!perEnvironment.TryGetValue(environment, out var count))
                {
                    continue;
                }

                var limit = repoLimits.TryGetValue(environment, out var value) ? value : 0;

                if (limit != catalogue.Unlimited && limit >= 0 && count > limit)
                {
                    return (null, $"repos_limit_exceeded:{environment}");
                }
            }

            return (plan, null);
        }

        public async Task<Dictionary<string, long>> RepoLimitsAsync(
            string? tenantGroupId,
            IEnumerable<string>? creatingFree = null,
            CancellationToken cancellationToken = default)
        {
            var catalogue = _catalogue.Catalogue;
            var free = new HashSet<string>(creatingFree ?? [], StringComparer.Ordinal);
            var purchased = new Dictionary<string, long>(StringComparer.Ordinal);

            if (!string.IsNullOrWhiteSpace(tenantGroupId))
            {
                var held = await _inventory.GetAsync(tenantGroupId, null, cancellationToken).ConfigureAwait(false);
                free.UnionWith(held.FreeEnvironments);

                var tenantIds = held.TenantIds.Values.Where(id => !string.IsNullOrWhiteSpace(id)).ToList();

                if (tenantIds.Count > 0)
                {
                    var usage = await _usage.GetAsync(tenantGroupId, tenantIds, cancellationToken).ConfigureAwait(false);

                    foreach (var environment in usage?.Environments ?? [])
                    {
                        // The quota row knows its environment; fall back to the tenant map for a
                        // tenant that has never been seeded and so has no rows to say so.
                        var key = !string.IsNullOrWhiteSpace(environment.Environment)
                            ? environment.Environment
                            : held.TenantIds.FirstOrDefault(t => t.Value == environment.TenantId).Key;

                        var bought = environment.Services
                            .SelectMany(s => s.Meters)
                            .FirstOrDefault(m => m.Meter == ReposMeter)?.Purchased ?? 0;

                        if (!string.IsNullOrWhiteSpace(key) && bought > 0)
                        {
                            purchased[key] = bought;
                        }
                    }
                }
            }

            var limits = new Dictionary<string, long>(StringComparer.Ordinal);

            foreach (var environment in catalogue.Environments.Keys)
            {
                var included = catalogue.LimitsFor(environment, free.Contains(environment));

                // A meter the environment does not list is a feature it does not include.
                var limit = included.TryGetValue(ReposMeter, out var value) ? value : 0;

                limits[environment] = limit == catalogue.Unlimited
                    ? limit
                    : limit + purchased.GetValueOrDefault(environment);
            }

            return limits;
        }

        /// <summary>Upper bound on rows in one plan. Far above any real project; a guard against abuse.</summary>
        public const int MaxRows = 200;

        private static HashSet<string> LiveResourceIds(IEnumerable<Resource>? resources) =>
            new((resources ?? [])
                .Where(r => r is not null && !r.IsArchived && !string.IsNullOrWhiteSpace(r.ResourceId))
                .Select(r => r.ResourceId),
                StringComparer.Ordinal);

        /// <summary>The catalogue key for an environment, through its aliases; null when unknown.</summary>
        private static string? Normalise(string? environment, PlanCatalogue catalogue)
        {
            var key = environment?.Trim() ?? string.Empty;

            if (catalogue.Aliases.TryGetValue(key, out var alias))
            {
                key = alias;
            }

            return catalogue.Environments.ContainsKey(key) ? key : null;
        }

        private static T Refused<T>(string key, string message) where T : BaseResponse, new() =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
    }

    public class GetRepositoryDeploymentsRequest
    {
        public string TenantGroupId { get; set; } = string.Empty;
    }

    public class GetRepositoryDeploymentsResponse : BaseResponse
    {
        public string TenantGroupId { get; set; } = string.Empty;
        public List<RepositoryDeployment> Deployments { get; set; } = [];

        /// <summary>Repositories allowed per environment key. -1 is unlimited.</summary>
        public Dictionary<string, long> RepoLimits { get; set; } = [];
    }

    public class SaveRepositoryDeploymentsRequest
    {
        public string TenantGroupId { get; set; } = string.Empty;
        public List<RepositoryDeployment>? Deployments { get; set; }
    }

    public class SaveRepositoryDeploymentsResponse : BaseResponse
    {
        /// <summary>The plan as stored: aliases resolved, duplicates and empty rows dropped.</summary>
        public List<RepositoryDeployment> Deployments { get; set; } = [];
    }
}
