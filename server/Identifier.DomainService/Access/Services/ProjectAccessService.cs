using Blocks.Genesis;
using DomainService.Entities;
using DomainService.People;
using DomainService.Projects;
using Microsoft.AspNetCore.Http;

namespace DomainService.Access.Services
{
    public class ProjectAccessService : IProjectAccessService
    {
        private readonly IProjectRepository _projectRepository;
        private readonly IPeopleRepository _peopleRepository;
        private readonly IKeyValueStore _store;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ProjectAccessService(IProjectRepository projectRepository,
                                    IPeopleRepository peopleRepository,
                                    IKeyValueStore store,
                                    IHttpContextAccessor httpContextAccessor)
        {
            _projectRepository = projectRepository;
            _peopleRepository = peopleRepository;
            _store = store;
            _httpContextAccessor = httpContextAccessor;
        }

        // ── Resolution ──────────────────────────────────────────────────────────

        public async Task<ProjectAccessContext> ResolveAsync(string projectGroupId, CancellationToken cancellationToken = default)
        {
            var items = _httpContextAccessor.HttpContext?.Items;
            var cacheKey = $"{ProjectAccessContext.HttpItemsKey}::{projectGroupId}";

            if (items is not null && items.TryGetValue(cacheKey, out var cached) && cached is ProjectAccessContext hit)
            {
                return hit;
            }

            var userId = BlocksContext.GetContext()?.UserId ?? string.Empty;
            var tenantIds = string.IsNullOrWhiteSpace(projectGroupId)
                ? []
                : await _projectRepository.GetProjectIdsByGroupId(projectGroupId);

            var rows = tenantIds.Count == 0 || string.IsNullOrWhiteSpace(userId)
                ? []
                : await _peopleRepository.GetProjectPeoplesAsync(userId, tenantIds);

            var catalog = await GetCatalogAsync(cancellationToken).ConfigureAwait(false);

            var context = new ProjectAccessContext
            {
                ProjectGroupId = projectGroupId,
                TenantIds = tenantIds,
                IsMember = rows.Count > 0,
                UserId = userId,
                RowCount = rows.Count,
                OwnerRowCount = rows.Count(row => row.IsCreator),
                // Owner means holding an IsCreator row anywhere in the group — the semantics
                // this has always had. Two stricter rules were tried and both were wrong: "on
                // every tenant" locks out genuine owners, because GetProjectIdsByGroupId counts
                // disabled projects while disabling one deletes its ProjectPeoples rows; and
                // anchoring on the first environment stakes everything on one row surviving.
                //
                // Nothing is lost by being forgiving here, because the escalation is closed
                // where it happens rather than here: only two paths write IsCreator, and both
                // are shut. TransferOwnership is [ProjectPolicy(OwnerOnly)], and provisioning an
                // environment attributes the row to the group's existing owner instead of to
                // whoever triggered it.
                IsOwner = rows.Exists(row => row.IsCreator),
                Policies = Intersect(Union(rows), catalog),
            };

            items?[cacheKey] = context;
            return context;
        }

        /// <summary>
        /// The group a single project belongs to, given either its item id or its tenant id
        /// (a "project key"). One method rather than one per id kind: the caller cannot always
        /// tell which it holds, and trying both is a miss on a document either way.
        /// </summary>
        public async Task<string?> ResolveGroupOfProjectAsync(string projectRef)
        {
            if (string.IsNullOrWhiteSpace(projectRef)) return null;

            var project = await _projectRepository.GetByTenantIdAsync(projectRef)
                       ?? await _projectRepository.GetByIdAsync(projectRef);

            return string.IsNullOrWhiteSpace(project?.TenantGroupId) ? null : project.TenantGroupId;
        }

        // ── Catalog ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Reads the grantable catalog from the key-value store. Read-only: the document is seed
        /// data maintained outside the application, and anything writing it back would race an
        /// operator's edit.
        /// </summary>
        /// <remarks>
        /// <c>impersonated: false</c> reads the root database, where <c>ProjectPeoples</c> also
        /// lives. The default (<c>true</c>) would read whichever tenant the caller happens to be
        /// in, which is not where the document is.
        ///
        /// Cached for the request alongside the access context — it is consulted several times
        /// per call (resolve, then render, then validate) and never changes mid-request.
        /// </remarks>
        public async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> GetCatalogAsync(CancellationToken cancellationToken = default)
        {
            var items = _httpContextAccessor.HttpContext?.Items;

            if (items is not null && items.TryGetValue(CatalogCacheKey, out var cached)
                && cached is IReadOnlyDictionary<string, IReadOnlyList<string>> hit)
            {
                return hit;
            }

            var stored = await _store
                .GetAsync<Dictionary<string, List<string>>>(ProjectAccessCatalog.StoreKey, impersonated: false, cancellationToken)
                .ConfigureAwait(false);

            var catalog = stored is { Count: > 0 }
                ? stored.ToDictionary(entry => entry.Key, entry => (IReadOnlyList<string>)entry.Value)
                : ProjectAccessCatalog.Empty;

            if (items is not null) items[CatalogCacheKey] = catalog;
            return catalog;
        }

        private const string CatalogCacheKey = "blocks-os::project-access-catalog";


        public async Task<IReadOnlyList<string>> FindUnknownPoliciesAsync(IEnumerable<string> declaredPolicies, CancellationToken cancellationToken = default)
        {
            var catalog = await GetCatalogAsync(cancellationToken).ConfigureAwait(false);
            var known = ProjectAccessCatalog.Flatten(catalog).ToHashSet(StringComparer.Ordinal);

            return declaredPolicies
                .Where(policy => !string.IsNullOrWhiteSpace(policy) && !known.Contains(policy))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        // ── Reads ───────────────────────────────────────────────────────────────

        public async Task<GetMyAccessResponse> GetMyAccessAsync(string projectGroupId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(projectGroupId))
            {
                return Invalid<GetMyAccessResponse>("project_group_required", "ProjectGroupId is required.");
            }

            var context = await ResolveAsync(projectGroupId, cancellationToken).ConfigureAwait(false);
            var catalog = await GetCatalogAsync(cancellationToken).ConfigureAwait(false);

            var policies = context.IsOwner
                ? ProjectAccessCatalog.Flatten(catalog).ToHashSet(StringComparer.Ordinal)
                : context.Policies;

            return new GetMyAccessResponse
            {
                IsSuccess = true,
                IsOwner = context.IsOwner,
                Role = context.IsOwner ? ProjectRoles.Owner : ProjectRoles.Contributor,
                Menus = ToMenuGrants(policies, catalog),
                Environments = context.TenantIds.Count == 0 ? [] : await MemberEnvironmentsAsync(context),
            };
        }

        public async Task<List<string>> GetPoliciesForSeedingAsync(string projectGroupId, string userId)
        {
            if (string.IsNullOrWhiteSpace(projectGroupId) || string.IsNullOrWhiteSpace(userId)) return [];

            var tenantIds = await _projectRepository.GetProjectIdsByGroupId(projectGroupId);
            if (tenantIds.Count == 0) return [];

            var rows = await _peopleRepository.GetProjectPeoplesAsync(userId, tenantIds);
            return [.. Union(rows)];
        }

        // ── Write ───────────────────────────────────────────────────────────────

        public async Task<SaveAccessPolicyResponse> SaveAccessPolicyAsync(SaveAccessPolicyRequest request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.ProjectGroupId) || string.IsNullOrWhiteSpace(request.UserId))
            {
                return Invalid<SaveAccessPolicyResponse>("property_missing", "ProjectGroupId and UserId are required.");
            }

            var tenantIds = await _projectRepository.GetProjectIdsByGroupId(request.ProjectGroupId);
            if (tenantIds.Count == 0)
            {
                return Invalid<SaveAccessPolicyResponse>("invalid_group_id", "The given groupId is invalid.");
            }

            var rows = await _peopleRepository.GetProjectPeoplesAsync(request.UserId, tenantIds);
            if (rows.Count == 0)
            {
                return Invalid<SaveAccessPolicyResponse>("not_a_member", "That person is not a member of this project.");
            }

            // An owner already holds everything implicitly; writing grants onto their rows would
            // create a second, divergent answer to "what may they do".
            if (rows.Count(row => row.IsCreator) == tenantIds.Count)
            {
                return Invalid<SaveAccessPolicyResponse>("owner_has_full_access", "Owners already have every menu; there is nothing to grant.");
            }

            var catalog = await GetCatalogAsync(cancellationToken).ConfigureAwait(false);
            var known = ProjectAccessCatalog.Flatten(catalog).ToHashSet(StringComparer.Ordinal);

            var submitted = (request.AccessPolicies ?? [])
                .Where(policy => !string.IsNullOrWhiteSpace(policy))
                .Select(policy => policy.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            var unknown = submitted.Where(policy => !known.Contains(policy)).ToList();
            if (unknown.Count > 0)
            {
                return Invalid<SaveAccessPolicyResponse>("unknown_policy", $"Not in the catalog: {string.Join(", ", unknown)}");
            }

            // "view" is implied by any other action on the same menu. Applied on the way in as
            // well as on the way out, so a policy that reaches the database is never one the
            // reader has to repair.
            foreach (var menu in submitted
                         .Select(policy => ProjectAccessCatalog.TryParse(policy, out var m, out var a) && a != ProjectAccessCatalog.ViewAction ? m : null)
                         .Where(menu => menu is not null)
                         .Distinct(StringComparer.Ordinal)
                         .ToList())
            {
                var view = ProjectAccessCatalog.Policy(menu!, ProjectAccessCatalog.ViewAction);
                if (known.Contains(view) && !submitted.Contains(view, StringComparer.Ordinal))
                {
                    submitted.Add(view);
                }
            }

            submitted.Sort(StringComparer.Ordinal);

            // Every row of that member in the group, in one write. Grants are group-wide while
            // the membership rows are per-environment, so a single-row write would leave the
            // rows disagreeing with each other.
            await _peopleRepository.UpdateAccessPoliciesAsync([.. rows.Select(row => row.ItemId)], submitted);

            return new SaveAccessPolicyResponse { IsSuccess = true, AccessPolicies = submitted };
        }

        // ── Helpers ─────────────────────────────────────────────────────────────

        private async Task<List<string>> MemberEnvironmentsAsync(ProjectAccessContext context)
        {
            var userId = BlocksContext.GetContext()?.UserId ?? string.Empty;
            if (string.IsNullOrWhiteSpace(userId)) return [];

            var rows = await _peopleRepository.GetProjectPeoplesAsync(userId, context.TenantIds);

            var environments = new List<string>();
            foreach (var row in rows)
            {
                var project = await _projectRepository.GetByTenantIdAsync(row.TenantId);
                if (!string.IsNullOrWhiteSpace(project?.Environment) && !environments.Contains(project.Environment))
                {
                    environments.Add(project.Environment);
                }
            }

            return environments;
        }

        private static HashSet<string> Union(IEnumerable<ProjectPeople> rows)
        {
            // Union, not first-row: the rows should agree, and a union means they still behave
            // correctly on the day one of them does not.
            var union = new HashSet<string>(StringComparer.Ordinal);
            foreach (var row in rows)
            {
                if (row.AccessPolicies is null) continue;
                foreach (var policy in row.AccessPolicies)
                {
                    if (!string.IsNullOrWhiteSpace(policy)) union.Add(policy.Trim());
                }
            }
            return union;
        }

        private static HashSet<string> Intersect(HashSet<string> policies, IReadOnlyDictionary<string, IReadOnlyList<string>> catalog)
        {
            // The stored list is hand-editable, so a retired or mistyped entry can reach a read.
            // Intersecting means the sidebar can never show a menu the server then refuses.
            var known = ProjectAccessCatalog.Flatten(catalog).ToHashSet(StringComparer.Ordinal);
            var kept = new HashSet<string>(policies.Where(known.Contains), StringComparer.Ordinal);

            foreach (var menu in kept
                         .Select(policy => ProjectAccessCatalog.TryParse(policy, out var m, out _) ? m : null)
                         .Where(menu => menu is not null)
                         .Distinct(StringComparer.Ordinal)
                         .ToList())
            {
                var view = ProjectAccessCatalog.Policy(menu!, ProjectAccessCatalog.ViewAction);
                if (known.Contains(view)) kept.Add(view);
            }

            return kept;
        }

        private static List<MenuGrant> ToMenuGrants(HashSet<string> policies, IReadOnlyDictionary<string, IReadOnlyList<string>> catalog)
        {
            return catalog
                .Select(entry => new MenuGrant
                {
                    MenuId = entry.Key,
                    Actions = [.. entry.Value.Where(action => policies.Contains(ProjectAccessCatalog.Policy(entry.Key, action)))],
                })
                .Where(grant => grant.Actions.Count > 0)
                .ToList();
        }

        private static T Invalid<T>(string code, string message) where T : Blocks.Genesis.BaseResponse, new()
        {
            return new T { IsSuccess = false, Errors = new Dictionary<string, string> { { code, message } } };
        }
    }
}
