using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using BlocksOs.Api.Controllers;
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

namespace XUnitTest.Services
{
    public class ProjectPolicyFilterTests
    {
        private readonly Mock<IProjectAccessService> _access = new();

        [Fact]
        public async Task Create_without_a_group_does_not_resolve_the_current_tenant()
        {
            var context = Context(new CreateProjectRequest());
            var executed = false;

            await new ProjectPolicyFilter(_access.Object).OnActionExecutionAsync(context, () =>
            {
                executed = true;
                return Task.FromResult(new ActionExecutedContext(
                    context, context.Filters, context.Controller));
            });

            executed.Should().BeTrue();
            _access.Verify(service => service.ResolveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Create_with_a_group_still_requires_its_owner()
        {
            _access.Setup(service => service.ResolveAsync("existing", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ProjectAccessContext { ProjectGroupId = "existing" });
            var context = Context(new CreateProjectRequest { TenantGroupId = "existing" });
            var executed = false;

            await new ProjectPolicyFilter(_access.Object).OnActionExecutionAsync(context, () =>
            {
                executed = true;
                return Task.FromResult(new ActionExecutedContext(
                    context, context.Filters, context.Controller));
            });

            executed.Should().BeFalse();
            context.Result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
            _access.Verify(service => service.ResolveAsync("existing", It.IsAny<CancellationToken>()), Times.Once);
        }

        private static ActionExecutingContext Context(CreateProjectRequest request)
        {
            var method = typeof(ProjectController).GetMethod(nameof(ProjectController.Create))!;
            var descriptor = new ControllerActionDescriptor
            {
                ControllerTypeInfo = typeof(ProjectController).GetTypeInfo(),
                MethodInfo = method,
            };
            var actionContext = new ActionContext(
                new DefaultHttpContext(), new RouteData(), descriptor, new ModelStateDictionary());

            return new ActionExecutingContext(
                actionContext,
                new List<IFilterMetadata>(),
                new Dictionary<string, object?> { ["request"] = request },
                new object());
        }
    }
}
