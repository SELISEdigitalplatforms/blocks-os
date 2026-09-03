namespace DomainService.Access
{
    /// <summary>
    /// The set of grants an owner may hand to a contributor: menus, and the actions inside them.
    /// </summary>
    /// <remarks>
    /// The document lives in the <c>keyValueStores</c> collection under <see cref="StoreKey"/>,
    /// read through Genesis's <c>IKeyValueStore</c>. Nothing in the application writes it — it is
    /// seed data, inserted and edited outside the code, so a menu or an action can be added
    /// without a deploy.
    ///
    /// Owner-only actions are <b>absent by definition</b> — creating an environment, restoring
    /// one, transferring ownership and saving a policy are not in there. That single rule is what
    /// makes the owner UI correct for free: it renders the catalog, so it can never offer
    /// something that is not delegable.
    ///
    /// If the document is missing the catalog is empty, which leaves contributors with nothing
    /// grantable. Owners are unaffected — ownership is decided from <c>ProjectPeoples</c>, and
    /// both the route gate and the sidebar treat an owner as holding everything without
    /// consulting this at all.
    /// </remarks>
    public static class ProjectAccessCatalog
    {
        /// <summary>
        /// Single-value key. Never mix the store's multi-value API onto it — its own docs warn
        /// that doing so leaves reads returning an arbitrary document.
        /// </summary>
        public const string StoreKey = "project-access-catalog";

        /// <summary>
        /// Read of a menu. Implied by holding any other action on the same menu, so a grant can
        /// never exist without the read it depends on.
        /// </summary>
        public const string ViewAction = "view";

        public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> Empty =
            new Dictionary<string, IReadOnlyList<string>>();

        public static string Policy(string menu, string action) => $"{menu}::{action}";

        /// <summary>Every grantable policy string in a catalog, flattened.</summary>
        public static IReadOnlyList<string> Flatten(IReadOnlyDictionary<string, IReadOnlyList<string>> catalog)
        {
            return catalog
                .SelectMany(entry => entry.Value.Select(action => Policy(entry.Key, action)))
                .ToList();
        }

        /// <summary>
        /// Splits <c>menu::action</c>. Returns false for anything that is not exactly two
        /// non-empty segments — which is also what keeps a three-segment RBAC resource name from
        /// ever being accepted as a grant.
        /// </summary>
        public static bool TryParse(string? policy, out string menu, out string action)
        {
            menu = string.Empty;
            action = string.Empty;

            if (string.IsNullOrWhiteSpace(policy)) return false;

            var parts = policy.Split("::", StringSplitOptions.None);
            if (parts.Length != 2) return false;
            if (string.IsNullOrWhiteSpace(parts[0]) || string.IsNullOrWhiteSpace(parts[1])) return false;

            menu = parts[0].Trim();
            action = parts[1].Trim();
            return true;
        }
    }
}
