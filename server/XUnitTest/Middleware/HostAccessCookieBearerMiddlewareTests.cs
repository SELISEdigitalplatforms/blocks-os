using BlocksOs.Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace XUnitTest.Middleware;

public class HostAccessCookieBearerMiddlewareTests
{
    [Fact]
    public void PromoteSetsAuthorizationFromHostNamedCookie()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os-612.blocksdevelopers.com");
        context.Request.Headers.Cookie = "dev-os-612.blocksdevelopers.com=eyJhbGciOi.test-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.Authorization.ToString()
            .Should().Be("Bearer eyJhbGciOi.test-token");
    }

    [Fact]
    public void PromoteLeavesExistingAuthorizationUntouched()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os-612.blocksdevelopers.com");
        context.Request.Headers.Authorization = "Bearer already-set";
        context.Request.Headers.Cookie = "dev-os-612.blocksdevelopers.com=other-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.Authorization.ToString()
            .Should().Be("Bearer already-set");
    }

    [Fact]
    public void PromoteNoopWhenHostCookieMissing()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os-612.blocksdevelopers.com");
        context.Request.Headers.Cookie = "unrelated=value";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.ContainsKey("Authorization").Should().BeFalse();
    }
}
