namespace DomainService.Access.Services
{
    public interface IProjectAccessService
    {
        /// <summary>
        /// Resolves the caller's standing in one project group. Cached in <c>HttpContext.Items</c>
        /// for the life of the request, so the filter and the service behind it share one lookup
        /// instead of each paying for the tenant-id and membership queries.
        /// </summary>
        Task<ProjectAccessContext> ResolveAsync(string projectGroupId, CancellationToken cancellationToken = default);

        /// <summary>The group a single project belongs to, by tenant id or item id. Null if unknown.</summary>
        Task<string?> ResolveGroupOfProjectAsync(string projectRef);

        /// <summary>Everything an owner may grant, read from the key-value store.</summary>
        Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> GetCatalogAsync(CancellationToken cancellationToken = default);

        Task<GetMyAccessResponse> GetMyAccessAsync(string projectGroupId, CancellationToken cancellationToken = default);

        Task<SaveAccessPolicyResponse> SaveAccessPolicyAsync(SaveAccessPolicyRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// The grants a member already holds in a group, used to seed the rows created when they
        /// are added to a further environment so the N rows stay identical.
        /// </summary>
        Task<List<string>> GetPoliciesForSeedingAsync(string projectGroupId, string userId);

        /// <summary>Verifies every <c>[ProjectPolicy]</c> string in the assembly exists in the catalog.</summary>
        Task<IReadOnlyList<string>> FindUnknownPoliciesAsync(IEnumerable<string> declaredPolicies, CancellationToken cancellationToken = default);
    }
}
