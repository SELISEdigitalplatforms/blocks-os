using System.Collections.Generic;
using Blocks.Genesis;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Validators
{
    public class MailTemplateHtmlPolicyTests
    {
        private static readonly IReadOnlySet<string> AppHosts = MailTemplateHtmlPolicy.HostsOf(["https://app.example.com", "blocksapi.example.com/"]);

        private static IReadOnlyList<string> Problems(string html) => MailTemplateHtmlPolicy.FindProblems(html, AppHosts);

        [Fact]
        public void ATypicalEditorTemplate_IsAllowed()
        {
            const string html = """
                <!doctype html><html><head><meta charset="utf-8"><title>Reset</title>
                <link href="https://fonts.googleapis.com/css?family=Inter" rel="stylesheet">
                <style>body{font-family:Inter} .hero{background:url('https://cdn.example.net/hero.png')}</style></head>
                <body><table style="width:100%;background-image:url(data:image/png;base64,iVBORw0KGgo=)"><tr><td>
                <img src="https://cdn.example.net/logo.png" alt="logo">
                <img src="data:image/png;base64,iVBORw0KGgo=" alt="dot">
                <p>Hi {{UserName}}</p>
                <a href="{{EmailVerification.PageUrl}}">Reset password</a>
                <a href="https://app.example.com/help?x=1">Help</a>
                <a href="https://{{AppDomain}}/login">Log in</a>
                <a href="mailto:support@example.com">Mail us</a> <a href="tel:+100">Call</a> <a href="#top">Top</a>
                </td></tr></table></body></html>
                """;

            Problems(html).Should().BeEmpty();
        }

        [Theory]
        [InlineData("<script>alert(1)</script>", "<script>")]
        [InlineData("<SCRIPT src=https://app.example.com/x.js></SCRIPT>", "<script>")]
        [InlineData("<iframe src=\"https://app.example.com\"></iframe>", "<iframe>")]
        [InlineData("<form action=\"https://app.example.com/login\"><input name=p></form>", "<form>")]
        [InlineData("<object data=\"https://app.example.com/x\"></object>", "<object>")]
        [InlineData("<embed src=\"https://app.example.com/x\">", "<embed>")]
        [InlineData("<base href=\"https://evil.example/\">", "<base>")]
        [InlineData("<svg><a xlink:href=\"javascript:alert(1)\">x</a></svg>", "<svg>")]
        [InlineData("<meta http-equiv=\"Refresh\" content=\"0;url=https://evil.example\">", "refresh")]
        [InlineData("<img src=\"https://cdn.example.net/x.png\" onerror=\"alert(1)\">", "onerror")]
        [InlineData("<body onload=\"alert(1)\">", "onload")]
        public void ActiveContent_IsRefused(string html, string named)
        {
            Problems(html).Should().Contain(p => p.Contains(named, System.StringComparison.OrdinalIgnoreCase));
        }

        [Theory]
        [InlineData("<a href=\"https://evil.example/login\">Reset</a>", "evil.example")]
        [InlineData("<a href=\"https://app.example.com.evil.example/\">Reset</a>", "app.example.com.evil.example")]
        [InlineData("<a href=\"https://app.example.com@evil.example/\">Reset</a>", "evil.example")]
        [InlineData("<a href=\"https://evil.example/{{Token}}\">Reset</a>", "evil.example")]
        [InlineData("<area href=\"https://evil.example/\">", "evil.example")]
        public void ALinkToAForeignHost_IsRefused(string html, string host)
        {
            Problems(html).Should().ContainSingle().Which.Should().Contain($"A link to {host} is not allowed");
        }

        [Theory]
        [InlineData("<a href=\"javascript:alert(1)\">x</a>")]
        [InlineData("<a href=\"jav&#x61;script:alert(1)\">x</a>")]
        [InlineData("<a href=\" java\tscript:alert(1)\">x</a>")]
        [InlineData("<a href=\"http://app.example.com/\">x</a>")]
        [InlineData("<a href=\"data:text/html;base64,PHNjcmlwdD4=\">x</a>")]
        [InlineData("<a href=\"//evil.example/\">x</a>")]
        [InlineData("<a href=\"/relative\">x</a>")]
        [InlineData("<img src=\"http://cdn.example.net/x.png\">")]
        [InlineData("<img src=\"data:image/svg+xml;base64,PHN2Zz4=\">")]
        [InlineData("<img srcset=\"https://cdn.example.net/a.png 1x, http://cdn.example.net/b.png 2x\">")]
        [InlineData("<p style=\"background:url('javascript:alert(1)')\">x</p>")]
        [InlineData("<style>@import 'http://evil.example/a.css';</style>")]
        public void ANonHttpsAddress_IsRefused(string html)
        {
            Problems(html).Should().NotBeEmpty();
        }

        [Theory]
        [InlineData("<p style=\"width:expression(alert(1))\">x</p>")]
        [InlineData("<style>p{behavior:url(https://cdn.example.net/x.htc)}</style>")]
        public void ScriptInAStyle_IsRefused(string html)
        {
            Problems(html).Should().Contain(p => p.Contains("Script in a style"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("Plain text with {{Name}}")]
        public void EmptyOrPlainText_IsAllowed(string? html)
        {
            Problems(html!).Should().BeEmpty();
        }

        [Fact]
        public void WithNoKnownHosts_OnlyPlaceholderLinksPass()
        {
            var none = MailTemplateHtmlPolicy.HostsOf(null);

            MailTemplateHtmlPolicy.FindProblems("<a href=\"{{Url}}\">x</a>", none).Should().BeEmpty();
            MailTemplateHtmlPolicy.FindProblems("<a href=\"https://app.example.com\">x</a>", none).Should().ContainSingle();
        }

        [Fact]
        public void HostsOf_KeepsOnlyTheHost()
        {
            MailTemplateHtmlPolicy.HostsOf(["https://App.Example.com:8443/path/", "http://b.example.com", "c.example.com", "", null])
                .Should().BeEquivalentTo(["app.example.com", "b.example.com", "c.example.com"]);
        }

        [Fact]
        public void Checker_UsesTheCallingProjectsDomains()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1");
            var tenants = new Mock<ITenants>();
            tenants.Setup(t => t.GetTenantByID("project-1")).Returns(new Tenant
            {
                DbConnectionString = "mongodb://x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "project-1",
                Applications = [new Applications { Domain = "https://app.example.com" }]
            });
            var checker = new MailTemplateHtmlChecker(tenants.Object);

            checker.FindProblem("<a href=\"https://app.example.com/x\">x</a>").Should().BeNull();
            checker.FindProblem("<a href=\"https://evil.example/x\">x</a>").Should().Contain("evil.example");
            checker.FindProblem(null).Should().BeNull();
        }
    }
}
