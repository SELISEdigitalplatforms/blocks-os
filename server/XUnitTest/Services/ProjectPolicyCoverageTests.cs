using System.Reflection;
using BlocksOs.Api.Controllers;
using DomainService.Access;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;

namespace XUnitTest.Services
{
    /// <summary>
    /// Guards the shape of the <c>[ProjectPolicy]</c> declarations.
    /// </summary>
    /// <remarks>
    /// Whether a declared policy string is actually grantable is not checked here: the catalog
    /// lives in the key-value store and can be edited without a deploy, so the answer is a
    /// runtime one, not a compile-time one.
    /// </remarks>
    public class ProjectPolicyCoverageTests
    {
        /// <summary>
        /// Controllers whose endpoints are all project-scoped, or all deliberately not. Extend the
        /// list as other controllers are brought into the scheme.
        /// </summary>
        public static TheoryData<Type> Controllers =>
        [
            typeof(ProjectController),
            typeof(PeopleController),
            typeof(MigrationController),
        ];

        [Theory]
        [MemberData(nameof(Controllers))]
        public void Owner_only_endpoints_carry_no_policy_string(Type controller)
        {
            // OwnerOnly is unsatisfiable by design. Pairing it with a policy string would suggest
            // a grant could satisfy it, and the string would sit in the catalog unused.
            var contradictory = Actions(controller)
                .Select(action => (action, attribute: action.GetCustomAttribute<ProjectPolicyAttribute>(inherit: false)))
                .Where(pair => pair.attribute is { OwnerOnly: true } && !string.IsNullOrWhiteSpace(pair.attribute.Policy))
                .Select(pair => $"{controller.Name}.{pair.action.Name}")
                .ToList();

            contradictory.Should().BeEmpty("OwnerOnly endpoints are not grantable, so they take no policy string");
        }

        private static IEnumerable<MethodInfo> Actions(Type controller) =>
            controller
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(method => !method.IsSpecialName)
                .Where(method => method.GetCustomAttributes<HttpMethodAttribute>(inherit: false).Any());
    }
}
