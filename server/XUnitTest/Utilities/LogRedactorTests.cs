using Cloud.LmtService.Utilities;
using FluentAssertions;
using System.Text.RegularExpressions;

namespace XUnitTest.Utilities
{
    public class LogRedactorTests
    {
        [Fact]
        public void Redact_EmailAddress_IsMasked()
        {
            var input = "User login failed for jane.doe@example.com on attempt 3";

            var result = LogRedactor.Redact(input);

            result.Should().Be("User login failed for ***REDACTED*** on attempt 3");
        }

        [Fact]
        public void Redact_BearerToken_IsMasked()
        {
            var input = "Authorization header: Bearer abc123.def456-ghi_789";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Authorization header: ***REDACTED***");
        }

        [Fact]
        public void Redact_StandaloneJwt_IsMasked()
        {
            var input = "Token received: " + "eyJ" + "hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + "eyJ" + "zdWIiOiIxMjM0NTY3ODkwIn0." + "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" + " and stored";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Token received: ***REDACTED*** and stored");
        }

        [Fact]
        public void Redact_JsonPassword_MasksValueButKeepsKey()
        {
            var input = "Payload: {\"username\": \"bob\", \"password\": \"secret123\"}";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Payload: {\"username\": \"bob\", \"password\": \"***REDACTED***\"}");
        }

        [Fact]
        public void Redact_JsonPasswordNoSpaceAfterColon_MasksValueButKeepsKey()
        {
            var input = "{\"pwd\":\"secret123\"}";

            var result = LogRedactor.Redact(input);

            result.Should().Be("{\"pwd\":\"***REDACTED***\"}");
        }

        [Fact]
        public void Redact_QueryStringPassword_MasksValueButKeepsKey()
        {
            var input = "Request to /login?user=bob&password=secret123&remember=true failed";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Request to /login?user=bob&password=***REDACTED***&remember=true failed");
        }

        [Fact]
        public void Redact_ConnectionStringPassword_MasksPasswordSegment()
        {
            var input = "Server=myServer;Database=myDb;Password=SuperSecret1;Trusted_Connection=False;";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Server=myServer;Database=myDb;Password=***REDACTED***;Trusted_Connection=False;");
        }

        [Theory]
        [InlineData("Card on file: 4111 1111 1111 1111 expires soon", "Card on file: ***REDACTED*** expires soon")]
        [InlineData("Card on file: 4111-1111-1111-1111 expires soon", "Card on file: ***REDACTED*** expires soon")]
        [InlineData("Card on file: 4111111111111111 expires soon", "Card on file: ***REDACTED*** expires soon")]
        public void Redact_CreditCardNumber_IsMasked(string input, string expected)
        {
            var result = LogRedactor.Redact(input);

            result.Should().Be(expected);
        }

        [Fact]
        public void Redact_NonSensitiveText_IsUnchanged()
        {
            var input = "Executed action \"Api.Controllers.FooController.Bar\" in 42ms";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Fact]
        public void Redact_DottedTypeNameWithThreeLongSegments_IsUnchanged()
        {
            var input = "Executing endpoint \"Api.Controllers.AuthenticationController.ImpersonationStatus (Api)\"";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Fact]
        public void Redact_RealisticJwtWithEyJHeader_IsMasked()
        {
            var input = "Token: " + "eyJ" + "hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + "eyJ" + "zdWIiOiIxMjM0NTY3ODkwIn0." + "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" + " end";

            var result = LogRedactor.Redact(input);

            result.Should().Be("Token: ***REDACTED*** end");
        }

        // 1735689600000 is 2025-01-01T00:00:00Z in epoch milliseconds and fails the Luhn
        // checksum, so the credit-card matcher must leave it alone.
        [Fact]
        public void Redact_EpochMillisecondTimestamp_IsUnchanged()
        {
            var input = "Job scheduled at 1735689600000 for tenant acme";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Fact]
        public void Redact_ThirteenDigitNumberFailingLuhn_IsUnchanged()
        {
            var input = "Correlation window 1699999999999 closed";

            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void Redact_NullOrEmpty_ReturnsUnchanged(string? input)
        {
            var result = LogRedactor.Redact(input);

            result.Should().Be(input);
        }

        // A pattern that hits its match timeout must never let the original text through, not
        // even partially redacted: the whole value is replaced by the placeholder.
        [Fact]
        public void ApplyFailClosed_WhenAPatternTimesOut_ReturnsOnlyThePlaceholder()
        {
            var input = "password=hunter2 for jane.doe@example.com";

            var result = LogRedactor.ApplyFailClosed(input, _ =>
                throw new RegexMatchTimeoutException(input, ".*", TimeSpan.FromSeconds(1)));

            result.Should().Be(LogRedactor.Placeholder);
            result.Should().NotContain("hunter2");
        }

        [Fact]
        public void ApplyFailClosed_WhenRedactionSucceeds_ReturnsTheRedactedText()
        {
            var result = LogRedactor.ApplyFailClosed("abc", text => text.ToUpperInvariant());

            result.Should().Be("ABC");
        }

        // Real-world worst case: a large exception dump is still redacted within the timeout
        // rather than collapsing to the fail-closed placeholder.
        [Fact]
        public void Redact_LargeInput_IsRedactedWithinTheMatchTimeout()
        {
            var filler = string.Concat(Enumerable.Repeat("at Some.Namespace.Type.Method() in /src/File.cs:line 42\n", 20_000));
            var input = $"{filler}token Bearer abc123 for jane.doe@example.com";

            var result = LogRedactor.Redact(input);

            result.Should().EndWith("token ***REDACTED*** for ***REDACTED***");
            result.Should().StartWith("at Some.Namespace.Type.Method()");
        }
    }
}
