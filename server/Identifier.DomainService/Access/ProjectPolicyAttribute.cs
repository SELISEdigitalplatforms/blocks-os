namespace DomainService.Access
{
    /// <summary>
    /// Marks an endpoint as guarded by a project access policy: the owner passes, a contributor
    /// passes only if the owner granted them this action.
    /// </summary>
    /// <remarks>
    /// A third authorization layer, not to be confused with the two that already exist:
    /// <list type="number">
    /// <item><description><c>ProtectedEndPoint("blocks-os::people::invite")</c> — tenant RBAC,
    /// resolved from the caller's roles and permission claims. It knows nothing about
    /// projects.</description></item>
    /// <item><description><c>ProjectPeoples</c> membership — is this person in this project.</description></item>
    /// <item><description><c>ProjectPolicy("people::invite")</c> — <b>this</b>. What the owner
    /// granted a contributor inside one project group.</description></item>
    /// </list>
    /// The policy string is a different shape from a resource name on purpose — <c>menu::action</c>,
    /// two segments, against <c>blocks-os::area::action</c>, three — so neither can be mistaken
    /// for the other in code, config or logs.
    ///
    /// Enforced by <see cref="ProjectPolicyFilter"/>, an MVC action filter, so it always runs
    /// after the authorization middleware has applied <c>[Authorize]</c>/<c>[ProtectedEndPoint]</c>.
    /// An endpoint without this attribute is simply not project-scoped; there is no second
    /// attribute to declare that.
    /// </remarks>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
    public sealed class ProjectPolicyAttribute : Attribute
    {
        /// <param name="policy">
        /// The <c>menu::action</c> grant this endpoint requires. Omit it together with
        /// <see cref="OwnerOnly"/> for actions no grant can ever satisfy.
        /// </param>
        public ProjectPolicyAttribute(string policy = "")
        {
            Policy = policy ?? string.Empty;
        }

        public string Policy { get; }

        /// <summary>
        /// Only the project owner may call this — no grant satisfies it. A flag rather than a
        /// reserved policy string on purpose: <c>AccessPolicies</c> is a hand-editable list of
        /// strings, so anything expressible as a string is something somebody can type into it.
        /// </summary>
        public bool OwnerOnly { get; init; }
    }
}
