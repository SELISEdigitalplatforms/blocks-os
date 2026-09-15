using System.Collections.Generic;
using Cloud.LmtService.Utilities;
using FluentAssertions;

namespace XUnitTest.Utilities
{
    public class TraceRedactorTests
    {
        private const string Placeholder = "***REDACTED***";

        [Theory]
        [InlineData("http.request.header.Authorization")]
        [InlineData("SecurityContext")]
        [InlineData("api-key")]
        [InlineData("Api_Key")]
        [InlineData("Cookie")]
        [InlineData("access_token")]
        [InlineData("client-secret")]
        [InlineData("password")]
        [InlineData("db.passwd")]
        [InlineData("user.pwd")]
        [InlineData("credentials")]
        [InlineData("bearer")]
        public void RedactAttributes_SensitiveKey_MasksValueButKeepsKey(string key)
        {
            var attributes = new Dictionary<string, object?> { [key] = "something confidential" };

            TraceRedactor.RedactAttributes(attributes);

            attributes.Should().ContainKey(key);
            attributes[key].Should().Be(Placeholder);
        }

        [Fact]
        public void RedactAttributes_SensitiveKeyWithNonStringValue_IsAlsoMasked()
        {
            var attributes = new Dictionary<string, object?>
            {
                ["security.context"] = new Dictionary<string, object?> { ["UserId"] = "u1" }
            };

            TraceRedactor.RedactAttributes(attributes);

            attributes["security.context"].Should().Be(Placeholder);
        }

        [Theory]
        [InlineData("response.status.code", "200")]
        [InlineData("http.response.status_code", "500")]
        public void RedactAttributes_StatusCodeKeys_ArePreservedExactly(string key, string value)
        {
            var attributes = new Dictionary<string, object?> { [key] = value };

            TraceRedactor.RedactAttributes(attributes);

            attributes.Should().ContainKey(key);
            attributes[key].Should().Be(value);
        }

        [Fact]
        public void RedactAttributes_StatusCodeAsNumber_IsPreserved()
        {
            var attributes = new Dictionary<string, object?>
            {
                ["response.status.code"] = 200,
                ["http.response.status_code"] = 404
            };

            TraceRedactor.RedactAttributes(attributes);

            attributes["response.status.code"].Should().Be(200);
            attributes["http.response.status_code"].Should().Be(404);
        }

        [Fact]
        public void RedactAttributes_NonSensitiveStringWithEmbeddedJwt_MasksOnlyTheSecret()
        {
            var attributes = new Dictionary<string, object?>
            {
                ["http.request.headers"] =
                    "{ \"Accept\": \"application/json\", \"X-Forwarded\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk\" }"
            };

            TraceRedactor.RedactAttributes(attributes);

            attributes["http.request.headers"].Should()
                .Be("{ \"Accept\": \"application/json\", \"X-Forwarded\": \"" + Placeholder + "\" }");
        }

        [Fact]
        public void RedactAttributes_NonSensitiveNumericAndBooleanValues_AreUnchanged()
        {
            var attributes = new Dictionary<string, object?>
            {
                ["http.request.duration"] = 12.5,
                ["retry.count"] = 3,
                ["cache.hit"] = true,
                ["nested"] = new Dictionary<string, object?> { ["depth"] = 2 }
            };
            var nested = attributes["nested"];

            TraceRedactor.RedactAttributes(attributes);

            attributes["http.request.duration"].Should().Be(12.5);
            attributes["retry.count"].Should().Be(3);
            attributes["cache.hit"].Should().Be(true);
            attributes["nested"].Should().BeSameAs(nested);
        }

        [Fact]
        public void RedactAttributes_EndpointNameValue_IsUnchanged()
        {
            var attributes = new Dictionary<string, object?>
            {
                ["http.route"] = "Api.Controllers.AuthenticationController.ImpersonationStatus (Api)"
            };

            TraceRedactor.RedactAttributes(attributes);

            attributes["http.route"].Should()
                .Be("Api.Controllers.AuthenticationController.ImpersonationStatus (Api)");
        }

        [Fact]
        public void RedactAttributes_NullValue_IsLeftAsNull()
        {
            var attributes = new Dictionary<string, object?> { ["some.key"] = null };

            TraceRedactor.RedactAttributes(attributes);

            attributes["some.key"].Should().BeNull();
        }

        [Fact]
        public void RedactBaggage_SensitiveKey_MasksValueButKeepsKey()
        {
            var baggage = new Dictionary<string, string>
            {
                ["SecurityContext"] = "{\"UserId\":\"u1\",\"Roles\":[\"admin\"]}",
                ["tenant.id"] = "acme"
            };

            TraceRedactor.RedactBaggage(baggage);

            baggage.Should().ContainKey("SecurityContext");
            baggage["SecurityContext"].Should().Be(Placeholder);
            baggage["tenant.id"].Should().Be("acme");
        }

        [Fact]
        public void RedactBaggage_NonSensitiveValueWithEmbeddedEmail_IsRedacted()
        {
            var baggage = new Dictionary<string, string> { ["caller"] = "jane.doe@example.com" };

            TraceRedactor.RedactBaggage(baggage);

            baggage["caller"].Should().Be(Placeholder);
        }

        [Fact]
        public void RedactAttributes_NullOrEmptyMap_DoesNotThrow()
        {
            var act = () =>
            {
                TraceRedactor.RedactAttributes(null);
                TraceRedactor.RedactAttributes(new Dictionary<string, object?>());
            };

            act.Should().NotThrow();
        }

        [Fact]
        public void RedactBaggage_NullOrEmptyMap_DoesNotThrow()
        {
            var act = () =>
            {
                TraceRedactor.RedactBaggage(null);
                TraceRedactor.RedactBaggage(new Dictionary<string, string>());
            };

            act.Should().NotThrow();
        }
    }
}
