using Blocks.Genesis;

namespace DomainService.Access
{
    /// <summary>Roles a person holds inside one project group. Derived, never stored.</summary>
    public static class ProjectRoles
    {
        public const string Owner = "owner";
        public const string Contributor = "contributor";
    }

    /// <summary>One menu and the actions granted inside it.</summary>
    public class MenuGrant
    {
        public string MenuId { get; set; } = string.Empty;
        public List<string> Actions { get; set; } = [];
    }

    public class GetMyAccessRequest
    {
        public string ProjectGroupId { get; set; } = string.Empty;
    }

    /// <summary>
    /// What the caller may see and do in one project group. Shapes the UI; secures nothing —
    /// every write re-checks independently through <see cref="ProjectPolicyAttribute"/>.
    /// </summary>
    public class GetMyAccessResponse : BaseResponse
    {
        public string Role { get; set; } = ProjectRoles.Contributor;
        public bool IsOwner { get; set; }

        /// <summary>Menus with at least one granted action. Owners get the whole catalog.</summary>
        public List<MenuGrant> Menus { get; set; } = [];

        /// <summary>
        /// Environments this person belongs to. Project menus govern the project pages only;
        /// environment membership still governs the environment itself. Returned so "no menus"
        /// is never displayed as "no access at all".
        /// </summary>
        public List<string> Environments { get; set; } = [];
    }

    public class SaveAccessPolicyRequest
    {
        public string ProjectGroupId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;

        /// <summary>Flat <c>menu::action</c> strings. Anything outside the catalog is rejected.</summary>
        public List<string> AccessPolicies { get; set; } = [];
    }

    public class SaveAccessPolicyResponse : BaseResponse
    {
        public List<string> AccessPolicies { get; set; } = [];
    }

    /// <summary>
    /// One resolution of "who is this caller in this project group", done once per request and
    /// reused by the filter and the services behind it.
    /// </summary>
    public sealed class ProjectAccessContext
    {
        public const string HttpItemsKey = "blocks-os::project-access-context";

        public string ProjectGroupId { get; init; } = string.Empty;
        public List<string> TenantIds { get; init; } = [];
        public bool IsOwner { get; init; }
        public bool IsMember { get; init; }

        /// <summary>The caller's id at resolution time. Carried for diagnostics on a denial.</summary>
        public string UserId { get; init; } = string.Empty;

        /// <summary>How many rows the caller holds in the group, and how many carry IsCreator.</summary>
        public int RowCount { get; init; }

        public int OwnerRowCount { get; init; }

        /// <summary>Union of the member's rows in the group, already intersected with the catalog.</summary>
        public HashSet<string> Policies { get; init; } = [];
    }
}
