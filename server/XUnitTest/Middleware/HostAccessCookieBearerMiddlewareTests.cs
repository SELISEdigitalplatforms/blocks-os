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

    [Fact]
    public void PromoteSetsAuthorizationWhenOriginIsThisHost()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os.blocksdevelopers.com");
        context.Request.Headers.Origin = "https://dev-os.blocksdevelopers.com";
        context.Request.Headers.Cookie = "dev-os.blocksdevelopers.com=os-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.Authorization.ToString()
            .Should().Be("Bearer os-token");
    }

    [Fact]
    public void PromoteIgnoresPortAndCaseWhenComparingOriginToHost()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os.blocksdevelopers.com", 443);
        context.Request.Headers.Origin = "https://DEV-OS.blocksdevelopers.com:4000";
        context.Request.Headers.Cookie = "dev-os.blocksdevelopers.com=os-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.Authorization.ToString()
            .Should().Be("Bearer os-token");
    }

    [Fact]
    public void PromoteSkipsCrossOriginRequestSoGenesisUsesTheCallersCookie()
    {
        // Studio calling OS: the browser sends both apps' cookies, each impersonating a different
        // project. Promoting OS's own cookie would answer with the console tab's project.
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os.blocksdevelopers.com");
        context.Request.Headers.Origin = "https://dev-studio.blocksdevelopers.com";
        context.Request.Headers.Cookie =
            "dev-studio.blocksdevelopers.com=studio-token; dev-os.blocksdevelopers.com=os-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.ContainsKey("Authorization").Should().BeFalse();
    }

    [Theory]
    [InlineData("null")]
    [InlineData("not a url")]
    public void PromoteSkipsOpaqueOrUnparseableOrigin(string origin)
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os.blocksdevelopers.com");
        context.Request.Headers.Origin = origin;
        context.Request.Headers.Cookie = "dev-os.blocksdevelopers.com=os-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.ContainsKey("Authorization").Should().BeFalse();
    }

    [Fact]
    public void PromoteLeavesCrossOriginBearerUntouched()
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString("dev-os.blocksdevelopers.com");
        context.Request.Headers.Origin = "https://dev-studio.blocksdevelopers.com";
        context.Request.Headers.Authorization = "Bearer caller-token";
        context.Request.Headers.Cookie = "dev-os.blocksdevelopers.com=os-token";

        HostAccessCookieBearerMiddleware.PromoteHostAccessCookie(context);

        context.Request.Headers.Authorization.ToString()
            .Should().Be("Bearer caller-token");
    }
}
