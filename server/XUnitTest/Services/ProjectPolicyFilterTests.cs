using System.Reflection;
using DomainService.Access;
using DomainService.Access.Services;

using DomainService.Projects;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>
    /// How <see cref="ProjectPolicyFilter"/> decides which project a call is about. The
    /// authorization verdict itself is the easy half; picking the wrong project to ask about is
    /// what actually locked owners out of their own projects.
    /// </summary>
    public class ProjectPolicyFilterTests
    {
        private readonly Mock<IProjectAccessService> _access = new();

        /// <summary>
        /// Every endpoint on this stand-in mirrors the binding shape of a real one — that shape is
        /// the whole input to the resolution being tested.
        /// </summary>
        private sealed class StubController : ControllerBase
        {
            [ProjectPolicy(OwnerOnly = true)]
            public void Create(CreateProjectRequest request) { }

            [ProjectPolicy(OwnerOnly = true)]
            public void Disable(DisableProjectRequest request) { }

            [ProjectPolicy("environments::view")]
            public void GetMigrationStatus(string tenantGroupId) { }

            public void Unguarded(CreateProjectRequest request) { }
        }

        [Fact]
        public async Task Create_WithNoGroup_IsNotAuthorizedAgainstTheCallersCurrentProject()
        {
            // The regression this exists for: the create-project wizard posts no TenantGroupId,
            // because the project does not exist yet. Resolution fell through to the tenant in
            // the caller's token -- whichever project they last opened -- and OwnerOnly then
            // refused them the creation of their own project ("Only the project owner can do
            // this", rows=0). A blank group has to mean "no project", not "this project".
            using var _ = new BlocksTestContext(tenantId: "DEVm5r5u3bv", impersonated: true);

            var context = ContextFor(nameof(StubController.Create),
                new Dictionary<string, object?> { ["request"] = new CreateProjectRequest { TenantGroupId = null } });

            var ran = await RunAsync(context);

            ran.Should().BeTrue("a brand-new project belongs to nobody yet, so there is nothing to authorize");
            context.Result.Should().BeNull();
            _access.Verify(a => a.ResolveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _access.Verify(a => a.ResolveGroupOfProjectAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Create_WithAGroup_IsAuthorizedAgainstThatGroup()
        {
            // The same endpoint appends an environment when a group IS named, and that is
            // owner-only for real. Skipping the check on a blank group must not skip it here.
            using var _ = new BlocksTestContext(tenantId: "DEVother", impersonated: true);
            Resolves("grp-1", isOwner: false, isMember: true);

            var context = ContextFor(nameof(StubController.Create),
                new Dictionary<string, object?> { ["request"] = new CreateProjectRequest { TenantGroupId = "grp-1" } });

            var ran = await RunAsync(context);

            ran.Should().BeFalse();
            Denial(context).Should().Contain("Only the project owner");
        }

        [Fact]
        public async Task Create_WithAGroupTheCallerOwns_Runs()
        {
            using var _ = new BlocksTestContext(tenantId: "DEVgrp1", impersonated: true);
            Resolves("grp-1", isOwner: true, isMember: true);

            var context = ContextFor(nameof(StubController.Create),
                new Dictionary<string, object?> { ["request"] = new CreateProjectRequest { TenantGroupId = "grp-1" } });

            (await RunAsync(context)).Should().BeTrue();
        }

        [Fact]
        public async Task Disable_WithAnEmptyRequest_FallsBackToTheProjectTheCallerIsIn()
        {
            // Project/Disable names no project at all: its request object has no fields, and the
            // project to disable is the impersonated tenant. The fallback exists for this, and
            // narrowing it must not take this case with it.
            using var _ = new BlocksTestContext(tenantId: "DEVgrp1", impersonated: true);
            _access.Setup(a => a.ResolveGroupOfProjectAsync("DEVgrp1")).ReturnsAsync("grp-1");
            Resolves("grp-1", isOwner: true, isMember: true);

            var context = ContextFor(nameof(StubController.Disable),
                new Dictionary<string, object?> { ["request"] = new DisableProjectRequest() });

            (await RunAsync(context)).Should().BeTrue();
            _access.Verify(a => a.ResolveGroupOfProjectAsync("DEVgrp1"), Times.Once);
        }

        [Fact]
        public async Task Disable_WhenTheCallerIsNotTheOwner_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: "DEVgrp1", impersonated: true);
            _access.Setup(a => a.ResolveGroupOfProjectAsync("DEVgrp1")).ReturnsAsync("grp-1");
            Resolves("grp-1", isOwner: false, isMember: true);

            var context = ContextFor(nameof(StubController.Disable),
                new Dictionary<string, object?> { ["request"] = new DisableProjectRequest() });

            (await RunAsync(context)).Should().BeFalse();
            Denial(context).Should().Contain("Only the project owner");
        }

        [Fact]
        public async Task AnAbsentQueryStringArgument_CountsAsNamingNoProject()
        {
            // [FromQuery] string binds to null when it is missing, so the argument's presence --
            // not its value -- is what says the endpoint is self-scoping. The endpoint rejects the
            // empty value itself, which is a clearer answer than an authorization error.
            using var _ = new BlocksTestContext(tenantId: "DEVgrp1", impersonated: true);

            var context = ContextFor(nameof(StubController.GetMigrationStatus),
                new Dictionary<string, object?> { ["tenantGroupId"] = null });

            (await RunAsync(context)).Should().BeTrue();
            _access.Verify(a => a.ResolveGroupOfProjectAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task AQueryStringArgument_ScopesTheCheckToItsGroup()
        {
            using var _ = new BlocksTestContext(tenantId: "DEVother", impersonated: true);
            Resolves("grp-1", isOwner: false, isMember: true, policies: ["environments::view"]);

            var context = ContextFor(nameof(StubController.GetMigrationStatus),
                new Dictionary<string, object?> { ["tenantGroupId"] = "grp-1" });

            (await RunAsync(context)).Should().BeTrue();
            _access.Verify(a => a.ResolveAsync("grp-1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task AGrantedMenuActionTheCallerDoesNotHold_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: "DEVother", impersonated: true);
            Resolves("grp-1", isOwner: false, isMember: true, policies: ["people::view"]);

            var context = ContextFor(nameof(StubController.GetMigrationStatus),
                new Dictionary<string, object?> { ["tenantGroupId"] = "grp-1" });

            (await RunAsync(context)).Should().BeFalse();
            Denial(context).Should().Contain("not been given access");
        }

        [Fact]
        public async Task TheOwner_PassesEveryGuardedEndpointWithoutHoldingAnyGrant()
        {
            // "The owner can do anything" is load-bearing: owners hold no AccessPolicies at all
            // (SaveAccessPolicy refuses to write any onto them), so an owner who had to satisfy
            // the policy string would satisfy none of them.
            using var _ = new BlocksTestContext(tenantId: "DEVother", impersonated: true);
            Resolves("grp-1", isOwner: true, isMember: true, policies: []);

            var context = ContextFor(nameof(StubController.GetMigrationStatus),
                new Dictionary<string, object?> { ["tenantGroupId"] = "grp-1" });

            (await RunAsync(context)).Should().BeTrue();
        }

        [Fact]
        public async Task AnEndpointWithoutTheAttribute_IsNotProjectScoped()
        {
            using var _ = new BlocksTestContext(tenantId: "DEVgrp1", impersonated: true);

            var context = ContextFor(nameof(StubController.Unguarded),
                new Dictionary<string, object?> { ["request"] = new CreateProjectRequest { TenantGroupId = "grp-1" } });

            (await RunAsync(context)).Should().BeTrue();
            _access.Verify(a => a.ResolveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ── Harness ─────────────────────────────────────────────────────────────

        private void Resolves(string groupId, bool isOwner, bool isMember, string[]? policies = null)
        {
            _access.Setup(a => a.ResolveAsync(groupId, It.IsAny<CancellationToken>()))
                   .ReturnsAsync(new ProjectAccessContext
                   {
                       ProjectGroupId = groupId,
                       IsOwner = isOwner,
                       IsMember = isMember,
                       Policies = [.. policies ?? []],
                   });
        }

        /// <summary>Whether the action itself was reached, which is the only pass signal.</summary>
        private async Task<bool> RunAsync(ActionExecutingContext context)
        {
            var ran = false;

            await new ProjectPolicyFilter(_access.Object).OnActionExecutionAsync(context, () =>
            {
                ran = true;
                return Task.FromResult(new ActionExecutedContext(context, context.Filters, context.Controller));
            });

            return ran;
        }

        private static ActionExecutingContext ContextFor(string actionName, Dictionary<string, object?> arguments)
        {
            var method = typeof(StubController).GetMethod(actionName)!;

            var actionContext = new ActionContext(
                new DefaultHttpContext(),
                new RouteData(),
                new ControllerActionDescriptor { MethodInfo = method, ActionName = actionName },
                new ModelStateDictionary());

            return new ActionExecutingContext(actionContext, [], arguments, new StubController());
        }

        private static string Denial(ActionExecutingContext context)
        {
            var result = context.Result.Should().BeOfType<ObjectResult>().Subject;
            result.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

            var response = result.Value.Should().BeOfType<Blocks.Genesis.BaseResponse>().Subject;
            response.IsSuccess.Should().BeFalse();

            return response.Errors!["own_project"];
        }
    }
}
