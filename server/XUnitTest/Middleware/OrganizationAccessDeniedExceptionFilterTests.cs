using System;
using System.Collections.Generic;
using Blocks.Genesis;
using BlocksOs.Api.Middleware;
using Configuration.DomainService.Organizations;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;

namespace XUnitTest.Middleware
{
    public class OrganizationAccessDeniedExceptionFilterTests
    {
        private static ExceptionContext ContextFor(Exception exception) =>
            new(new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()), new List<IFilterMetadata>())
            {
                Exception = exception,
            };

        [Fact]
        public void Another_organizations_records_are_403_with_the_usual_envelope()
        {
            var context = ContextFor(new OrganizationAccessDeniedException());

            new OrganizationAccessDeniedExceptionFilter().OnException(context);

            context.ExceptionHandled.Should().BeTrue();
            var result = context.Result.Should().BeOfType<ObjectResult>().Subject;
            result.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
            var body = result.Value.Should().BeOfType<BaseResponse>().Subject;
            body.IsSuccess.Should().BeFalse();
            body.Errors.Should().BeEquivalentTo(new Dictionary<string, string>
            {
                { OrganizationAccessDeniedExceptionFilter.ErrorKey, OrganizationAccessDeniedException.DefaultMessage },
            });
        }

        [Fact]
        public void Other_exceptions_are_left_alone()
        {
            var context = ContextFor(new InvalidOperationException("something else"));

            new OrganizationAccessDeniedExceptionFilter().OnException(context);

            context.ExceptionHandled.Should().BeFalse();
            context.Result.Should().BeNull();
        }
    }
}
