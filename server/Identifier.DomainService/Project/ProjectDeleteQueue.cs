namespace DomainService.Projects
{
    /// <summary>
    /// Payload of the <c>blocks_release_project_delete_listener</c> queue, telling blocks-release that
    /// something here was deleted so it can destroy the deployments that were running for it. This
    /// service owns the delete itself; nothing in blocks-release is asked to undo it.
    ///
    /// The class name is part of the contract, not just a label: Blocks.Genesis routes a message to a
    /// consumer by the payload type's name, so blocks-release's own <c>ProjectDeleteQueue</c> is only
    /// reached while this type is spelled the same way. Property names are equally load-bearing — the
    /// consumer deserializes case-sensitively.
    ///
    /// <see cref="TenantGroupId"/> is what says which tenant databases the message may reach, so it is
    /// mandatory and the other two only narrow it:
    /// <list type="bullet">
    /// <item><description>group -> every repository of every project in the group</description></item>
    /// <item><description>group + project -> every repository of that one project</description></item>
    /// <item><description>group + project + resource -> that single repository</description></item>
    /// <item><description>group + resource -> that resource's repository in every project of the group</description></item>
    /// </list>
    /// Anything without a group is dropped by the consumer rather than guessed at, including a bare
    /// <see cref="ProjectId"/> or a bare <see cref="ResourceId"/>.
    /// </summary>
    public class ProjectDeleteQueue
    {
        /// <summary>Required. Without it the consumer tears nothing down.</summary>
        public string TenantGroupId { get; set; }

        /// <summary>The tenant id of a single project, matching <c>Tenant.TenantId</c>.</summary>
        public string ProjectId { get; set; }

        /// <summary>The id of the linked resource, matching <c>Resource.ResourceId</c>.</summary>
        public string ResourceId { get; set; }
    }
}
