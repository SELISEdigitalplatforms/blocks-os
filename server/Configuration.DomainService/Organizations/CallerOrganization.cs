using Blocks.Genesis;

namespace Configuration.DomainService.Organizations
{
    /// <summary>
    /// The organizations the caller's token may act for, read from its <c>org_id</c>.
    /// </summary>
    /// <remarks>
    /// A token of the Default organization, or one without an organization, may act for every organization: the
    /// console's token, also when it impersonates a project. A token of any other organization, such as a Construct
    /// app's user or service token, is confined to that organization's own records and never sees the Default
    /// organization's or another organization's. A refusal throws <see cref="OrganizationAccessDeniedException"/>,
    /// which the API answers with 403.
    /// </remarks>
    public static class CallerOrganization
    {
        /// <summary>The organization the caller is confined to; null when the caller may act for every organization.</summary>
        public static string? Confined()
        {
            var organizationId = OrganizationIds.Normalize(BlocksContext.GetContext()?.OrganizationId);
            return organizationId == OrganizationIds.Default ? null : organizationId;
        }

        /// <summary>
        /// The organization a request names, held to the caller's. An unconfined caller's value comes back unchanged.
        /// A confined caller gets its own organization when the request names none, and a refusal when it names another
        /// one, the Default organization included.
        /// </summary>
        public static string? Scope(string? requestedOrganizationId)
        {
            var confined = Confined();
            if (confined is null)
                return requestedOrganizationId;

            if (!string.IsNullOrWhiteSpace(requestedOrganizationId) && OrganizationIds.Normalize(requestedOrganizationId) != confined)
                throw new OrganizationAccessDeniedException();

            return confined;
        }

        /// <summary>Refuses a stored record of an organization the caller is confined away from.</summary>
        public static void EnsureMayAccess(string? organizationId)
        {
            var confined = Confined();
            if (confined is not null && OrganizationIds.Normalize(organizationId) != confined)
                throw new OrganizationAccessDeniedException();
        }

        /// <summary>Refuses a confined caller an operation that spans organizations.</summary>
        public static void EnsureUnconfined()
        {
            if (Confined() is not null)
                throw new OrganizationAccessDeniedException();
        }
    }
}
