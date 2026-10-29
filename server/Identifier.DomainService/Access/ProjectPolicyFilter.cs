using System.Reflection;
using Blocks.Genesis;
using DomainService.Access.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace DomainService.Access
{
    /// <summary>
    /// Enforces <see cref="ProjectPolicyAttribute"/>: owner passes, contributor is checked
    /// against their grants, everyone else is refused.
    /// </summary>
    /// <remarks>
    /// Deliberately an <see cref="IAsyncActionFilter"/> rather than an authorization handler.
    /// The authorization middleware evaluates <c>[Authorize]</c>/<c>[ProtectedEndPoint]</c>
    /// before MVC filters run, so this cannot fire early even by accident — the ordering is
    /// structural, not arranged. It also runs after model binding, which is what lets the
    /// project be read straight off the bound request whether it arrived from the body or the
    /// query string.
    /// </remarks>
    public class ProjectPolicyFilter : IAsyncActionFilter
    {
        /// <summary>
        /// Where the project is looked for on a request, in order: the group directly, then
        /// anything naming a single project, then the caller's own tenant.
        /// </summary>
        /// <remarks>
        /// Matched against both argument names (a bare <c>[FromQuery] string tenantGroupId</c>)
        /// and property names on bound request objects. <c>GroupId</c> is in here because the
        /// People requests spell it that way; leaving it out meant Invite, ResendInvitation and
        /// RemoveAccess could not be scoped and so refused everyone, owners included.
        /// </remarks>
        private static readonly string[] GroupNames = ["TenantGroupId", "ProjectGroupId", "GroupId"];

        private static readonly string[] ProjectNames = ["ItemId", "ProjectKey", "TenantId"];

        private readonly IProjectAccessService _access;

        public ProjectPolicyFilter(IProjectAccessService access)
        {
            _access = access;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var policy = (context.ActionDescriptor as ControllerActionDescriptor)?
                .MethodInfo.GetCustomAttribute<ProjectPolicyAttribute>(inherit: false);

            if (policy is null)
            {
                await next();
                return;
            }

            var groupId = await ResolveGroupAsync(context);

            // No project named on the request and none in the token: this is not a call against
            // an existing project — creating a brand-new one from the console being the case
            // that matters. There is nothing to check, and every guarded endpoint validates its
            // own scope argument anyway, so a missing one fails in the service with its own
            // message rather than as an authorization error.
            if (string.IsNullOrWhiteSpace(groupId))
            {
                await next();
                return;
            }

            var access = await _access.ResolveAsync(groupId, context.HttpContext.RequestAborted);

            if (access.IsOwner)
            {
                await next();
                return;
            }

            // OwnerOnly is a flag rather than a reserved policy string precisely so no entry
            // typed into the hand-editable AccessPolicies list can satisfy it.
            if (policy.OwnerOnly)
            {
                // A bare "you are not the owner" is unfalsifiable from the outside: it cannot
                // distinguish the wrong project from a missing row from the wrong database. The
                // resolution is echoed back so a denial can be diagnosed from the response.
                context.Result = Denied("Only the project owner can do this.", Explain(access));
                return;
            }

            if (!access.IsMember)
            {
                context.Result = Denied("You are not allowed to access this project.");
                return;
            }

            if (string.IsNullOrWhiteSpace(policy.Policy) || !access.Policies.Contains(policy.Policy))
            {
                context.Result = Denied("You have not been given access to this part of the project.");
                return;
            }

            await next();
        }

        /// <summary>
        /// Finds the project group this call is about. Binding source is invisible here: MVC has
        /// already materialised <c>[FromQuery]</c> and <c>[FromBody]</c> alike into
        /// <see cref="ActionExecutingContext.ActionArguments"/>.
        /// </summary>
        private async Task<string?> ResolveGroupAsync(ActionExecutingContext context)
        {
            var namesAProject = false;

            foreach (var name in GroupNames)
            {
                if (!TryFind(context, name, out var groupId)) continue;

                namesAProject = true;
                if (!string.IsNullOrWhiteSpace(groupId)) return groupId;
            }

            foreach (var name in ProjectNames)
            {
                if (!TryFind(context, name, out var projectRef)) continue;

                namesAProject = true;
                if (string.IsNullOrWhiteSpace(projectRef)) continue;

                var groupId = await _access.ResolveGroupOfProjectAsync(projectRef);
                if (!string.IsNullOrWhiteSpace(groupId)) return groupId;
            }

            // A request that carries a project field but left it blank is deliberately unscoped,
            // and is not the same thing as a request with no field to fill in. Project/Create
            // with no TenantGroupId is a brand-new project, which belongs to nobody yet; falling
            // through to the caller's ambient tenant authorized it against whichever project
            // they had open, and refused them the creation of their own project.
            if (namesAProject) return null;

            // Endpoints naming no project at all, acting on whichever one the caller is currently
            // in — Project/Disable, whose request object is empty.
            return await _access.ResolveGroupOfProjectAsync(BlocksContext.GetContext()?.TenantId ?? string.Empty);
        }

        /// <summary>
        /// Looks for <paramref name="wanted"/> on the bound request. Returns whether the request
        /// carries it at all, which is separate from whether it was filled in — see
        /// <see cref="ResolveGroupAsync"/>, where the difference decides between "no project" and
        /// "the project the caller is in".
        /// </summary>
        private static bool TryFind(ActionExecutingContext context, string wanted, out string? value)
        {
            value = null;
            var found = false;

            foreach (var (argumentName, argument) in context.ActionArguments)
            {
                // A bare [FromQuery] string binds to null when it is absent from the query
                // string, so the argument's presence — not its value — is what declares it.
                if (argumentName.Equals(wanted, StringComparison.OrdinalIgnoreCase)
                    && argument is string or null)
                {
                    found = true;
                    value = argument as string;
                    if (!string.IsNullOrWhiteSpace(value)) return true;
                    continue;
                }

                if (argument is null or string) continue;

                var property = argument.GetType().GetProperty(wanted,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);

                if (property is null || property.PropertyType != typeof(string)) continue;

                found = true;
                if (property.GetValue(argument) is string text && !string.IsNullOrWhiteSpace(text))
                {
                    value = text;
                    return true;
                }
            }

            return found;
        }

        /// <summary>
        /// Denials keep the envelope the rest of the API uses. The manual owner checks this
        /// filter replaced returned 200 with <c>IsSuccess:false</c> and an <c>Errors</c> map, and
        /// the frontend's toast reads that map — a bare 403 would turn every one of those
        /// messages into a generic failure.
        /// </summary>
        private static string Explain(ProjectAccessContext access) =>
            $"group={access.ProjectGroupId}; tenants={access.TenantIds.Count}; " +
            $"userId={access.UserId}; rows={access.RowCount}; ownerRows={access.OwnerRowCount}";

        private static IActionResult Denied(string message, string? detail = null)
        {
            var errors = new Dictionary<string, string> { { "own_project", message } };
            if (!string.IsNullOrWhiteSpace(detail)) errors["resolution"] = detail;

            return new ObjectResult(new BaseResponse { IsSuccess = false, Errors = errors })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
        }
    }
}
