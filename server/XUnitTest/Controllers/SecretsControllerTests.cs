using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using BlocksOs.Api.Controllers;


using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Moq;

namespace XUnitTest.Controllers
{
    public class SecretsControllerTests
    {
        private readonly Mock<ISecretService> _service = new();

        private SecretsController Controller()
        {
            var controller = new SecretsController(_service.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
            };

            return controller;
        }

        [Fact]
        public async Task Set_ReturnsTheNewSecretId()
        {
            _service.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-1");

            var response = await Controller().Set(new SetSecretRequest { Name = "api-key" }, CancellationToken.None);

            response.SecretId.Should().Be("secret-1");
        }

        [Fact]
        public async Task Get_Returns404WhenTheSecretDoesNotExist()
        {
            _service.Setup(s => s.GetAsync("missing", It.IsAny<CancellationToken>()))
                    .ReturnsAsync((SecretResult?)null);

            var response = await Controller().Get("missing", CancellationToken.None);

            response.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task Value_MarksTheResponseNoStore()
        {
            _service.Setup(s => s.GetValueAsync("s1", It.IsAny<CancellationToken>()))
                    .ReturnsAsync("hunter2");

            var controller = Controller();
            var response = await controller.Value("s1", CancellationToken.None);

            response.Value.Should().Be("hunter2");
            controller.Response.Headers.CacheControl.ToString().Should().Contain("no-store");
        }

        [Fact]
        public async Task Unlock_UsesTheLockPermission()
        {
            // Lock and unlock are one capability; giving unlock its own resource would let a
            // role lock secrets it could never release.
            ResourceFor(nameof(SecretsController.Unlock))
                .Should().Be(ResourceFor(nameof(SecretsController.Lock)));

            await Task.CompletedTask;
        }

        [Theory]
        [InlineData(nameof(SecretsController.Set), "blocks-os::secret::save")]
        [InlineData(nameof(SecretsController.SetMany), "blocks-os::secret::save")]
        [InlineData(nameof(SecretsController.Get), "blocks-os::secret::gets")]
        [InlineData(nameof(SecretsController.Gets), "blocks-os::secret::gets")]
        [InlineData(nameof(SecretsController.Value), "blocks-os::secret::get-value")]
        [InlineData(nameof(SecretsController.Values), "blocks-os::secret::get-value")]
        [InlineData(nameof(SecretsController.Update), "blocks-os::secret::update")]
        [InlineData(nameof(SecretsController.Rotate), "blocks-os::secret::rotate")]
        [InlineData(nameof(SecretsController.Lock), "blocks-os::secret::lock")]
        [InlineData(nameof(SecretsController.Delete), "blocks-os::secret::delete")]
        [InlineData(nameof(SecretsController.Restore), "blocks-os::secret::restore")]
        [InlineData(nameof(SecretsController.Access), "blocks-os::secret::access")]
        [InlineData(nameof(SecretsController.Audit), "blocks-os::secret::audit")]
        public void EveryEndpointCarriesItsProtectedResource(string action, string expectedResource)
        {
            ResourceFor(action).Should().Be(expectedResource);
        }

        [Fact]
        public void NoEndpointIsLeftUnprotected()
        {
            var unprotected = typeof(SecretsController)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName)
                .Where(m => m.GetCustomAttribute<ProtectedEndPointAttribute>() is null)
                .Select(m => m.Name)
                .ToList();

            unprotected.Should().BeEmpty();
        }

        [Fact]
        public void MetadataResponsesNeverSerializeASecretValue()
        {
            var json = JsonSerializer.Serialize(new SecretResult
            {
                SecretId = "s1",
                Name = "api-key",
                Type = SecretTypes.Api,
                Status = SecretStatuses.Active
            });

            // Asserted on the serialized payload rather than the type, because that is what a
            // caller actually receives.
            json.Should().NotContain("\"Value\"");
            json.Should().NotContain("VaultUri");
            json.Should().NotContain("KeyVault");
        }

        private static string? ResourceFor(string action) =>
            typeof(SecretsController)
                .GetMethod(action)!
                .GetCustomAttribute<ProtectedEndPointAttribute>()?
                .ResourceName;
    }

    public class SecretExceptionFilterTests
    {
        [Theory]
        [InlineData(typeof(SecretValidationException), StatusCodes.Status400BadRequest)]
        [InlineData(typeof(SecretAccessDeniedException), StatusCodes.Status403Forbidden)]
        [InlineData(typeof(SecretNotFoundException), StatusCodes.Status404NotFound)]
        [InlineData(typeof(SecretStateException), StatusCodes.Status409Conflict)]
        [InlineData(typeof(SecretVaultException), StatusCodes.Status502BadGateway)]
        public void MapsSecretExceptionsOntoStatusCodes(Type exceptionType, int expectedStatus)
        {
            var context = ContextFor(Build(exceptionType));

            new SecretExceptionFilter().OnException(context);

            context.ExceptionHandled.Should().BeTrue();
            context.Result.Should().BeOfType<ObjectResult>()
                   .Which.StatusCode.Should().Be(expectedStatus);
        }

        [Fact]
        public void LeavesUnrelatedExceptionsAlone()
        {
            var context = ContextFor(new InvalidOperationException("something else"));

            new SecretExceptionFilter().OnException(context);

            context.ExceptionHandled.Should().BeFalse();
            context.Result.Should().BeNull();
        }

        [Fact]
        public void DoesNotLeakVaultDetailToTheCaller()
        {
            var inner = new InvalidOperationException("https://prod-vault.vault.azure.net timed out");
            var context = ContextFor(new SecretVaultException("Failed to read the value.", "Get", "s1", inner));

            new SecretExceptionFilter().OnException(context);

            var body = (BaseResponse)((ObjectResult)context.Result!).Value!;
            string.Join(" ", body.Errors.Values).Should().NotContain("vault.azure.net");
        }

        [Fact]
        public void SurfacesTheReasonCode()
        {
            var context = ContextFor(new SecretAccessDeniedException(SecretAuditReasons.NotInAccessList));

            new SecretExceptionFilter().OnException(context);

            var body = (BaseResponse)((ObjectResult)context.Result!).Value!;
            body.Errors.Should().ContainKey("reason");
            body.Errors["reason"].Should().Be(SecretAuditReasons.NotInAccessList);
        }

        private static Exception Build(Type exceptionType) => exceptionType switch
        {
            _ when exceptionType == typeof(SecretValidationException) => new SecretValidationException("bad"),
            _ when exceptionType == typeof(SecretAccessDeniedException) => new SecretAccessDeniedException("DENIED"),
            _ when exceptionType == typeof(SecretNotFoundException) => new SecretNotFoundException("s1"),
            _ when exceptionType == typeof(SecretStateException) => new SecretStateException(SecretStatuses.Locked, "read value"),
            _ => new SecretVaultException("vault down", "Get", "s1")
        };

        private static ExceptionContext ContextFor(Exception exception) =>
            new(
                new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()),
                new List<IFilterMetadata>())
            {
                Exception = exception
            };
    }
}
